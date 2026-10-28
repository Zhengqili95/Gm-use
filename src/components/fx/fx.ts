import { FX_PARTICLES, makeParticles, shouldAnimate, shouldCelebrate, tiltAngles, type Celebration } from './fx-logic.ts';
export { FX_PARTICLES } from './fx-logic.ts';

export type Effect = 'pop' | 'shake' | 'glow' | 'slide-in';
const durations = { pop: 360, shake: 320, glow: 1400, 'slide-in': 240 }; // Same lengths as fx.css (D-025).
const active = new WeakMap<HTMLElement, () => void>();
const motion = '(prefers-reduced-motion: reduce)';
const finePointer = '(hover: hover) and (pointer: fine)';

/** Tilts an element with the vl-fx-tilt class toward the mouse (D-025). Does nothing for touch, pens or reduced motion. */
export function tilt(el: HTMLElement | null, event: PointerEvent, max = 3): void {
	if (!el || event.pointerType !== 'mouse') return;
	const win = el.ownerDocument.defaultView;
	if (!win || !win.matchMedia(finePointer).matches || !shouldAnimate(win.matchMedia(motion).matches)) return;
	const rect = el.getBoundingClientRect();
	if (!rect.width || !rect.height) return;
	const angles = tiltAngles((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, max);
	el.style.setProperty('--vl-tilt-x', `${angles.x.toFixed(2)}deg`);
	el.style.setProperty('--vl-tilt-y', `${angles.y.toFixed(2)}deg`);
}

/** Levels the element again when the mouse leaves. */
export function untilt(el: HTMLElement | null): void {
	el?.style.removeProperty('--vl-tilt-x');
	el?.style.removeProperty('--vl-tilt-y');
}

/** One effect per element; replacing it also removes the previous listeners/timer. */
export function play(el: HTMLElement | null, effect: Effect): void {
	if (!el) return;
	active.get(el)?.();
	const win = el.ownerDocument.defaultView;
	if (!win || !el.isConnected) return;
	const preference = win.matchMedia(motion);
	if (!shouldAnimate(preference.matches)) return;
	const name = `vl-fx-${effect}`;
	const finish = () => {
		win.clearTimeout(timer);
		el.classList.remove(name);
		el.removeEventListener('animationend', ended);
		preference.removeEventListener('change', finish);
		active.delete(el);
	};
	const ended = (event: AnimationEvent) => {
		if (event.target === el && event.animationName === name) finish();
	};
	const timer = win.setTimeout(finish, durations[effect] + 80);
	active.set(el, finish);
	el.classList.remove(name);
	void el.offsetWidth; // Commit removal so repeated clicks restart the CSS animation.
	el.addEventListener('animationend', ended);
	preference.addEventListener('change', finish);
	el.classList.add(name);
}

let stopBurst: (() => void) | undefined;

/** At most one decorative canvas; a new burst replaces the previous one. */
export function celebrate(el: HTMLElement | null, kind: Celebration, options: { force?: boolean } = {}): void {
	if (!el?.isConnected) return;
	const doc = el.ownerDocument;
	const win = doc.defaultView;
	if (!win || doc.hidden) return;
	const preference = win.matchMedia(motion);
	if (!shouldCelebrate(preference.matches, FX_PARTICLES, options.force)) return;
	stopBurst?.();
	const canvas = doc.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	canvas.setAttribute('aria-hidden', 'true');
	canvas.className = 'vl-fx-particles';
	canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
	const width = win.innerWidth, height = win.innerHeight;
	const ratio = Math.min(win.devicePixelRatio || 1, 2);
	canvas.width = width * ratio;
	canvas.height = height * ratio;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	ctx.scale(ratio, ratio);
	doc.body.append(canvas);
	const rect = el.getBoundingClientRect();
	const particles = makeParticles(kind, rect.left + rect.width / 2, rect.top + rect.height / 2);
	const style = win.getComputedStyle(el);
	const colors = ['accent', 'accent-high', 'white'].map(key => style.getPropertyValue(`--sl-color-${key}`).trim() || '#3fae84');
	const start = win.performance.now();
	let frame = 0;
	const finish = () => {
		win.cancelAnimationFrame(frame);
		win.clearTimeout(timer);
		canvas.remove();
		preference.removeEventListener('change', finish);
		win.removeEventListener('resize', finish);
		win.removeEventListener('pagehide', finish);
		doc.removeEventListener('visibilitychange', finish);
		stopBurst = undefined;
	};
	const timer = win.setTimeout(finish, 1200);
	stopBurst = finish;
	preference.addEventListener('change', finish);
	win.addEventListener('resize', finish);
	win.addEventListener('pagehide', finish);
	doc.addEventListener('visibilitychange', finish);
	const draw = (now: number) => {
		const t = (now - start) / 1000;
		if (t >= 1.2 || !el.isConnected) return finish();
		ctx.clearRect(0, 0, width, height);
		ctx.globalAlpha = Math.max(0, 1 - t / 1.2); // One continuous fade, never flashing.
		particles.forEach((p, i) => {
			ctx.save();
			ctx.translate(p.x + p.vx * t, p.y + p.vy * t + 260 * t * t);
			ctx.rotate(p.angle + t);
			ctx.fillStyle = colors[i % colors.length];
			if (kind === 'lesson') ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
			else {
				ctx.beginPath();
				for (let n = 0; n < 10; n++) {
					const angle = n * Math.PI / 5, r = p.size * (n % 2 ? 0.45 : 1);
					ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
				}
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		});
		frame = win.requestAnimationFrame(draw);
	};
	frame = win.requestAnimationFrame(draw);
}
