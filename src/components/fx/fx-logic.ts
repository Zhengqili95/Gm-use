export type Celebration = 'pass' | 'lesson';
// D-025: on, but the lessons only call celebrate(…, 'lesson') when a lesson is finished (no stars on a passed exercise).
export const FX_PARTICLES = true;
export const shouldAnimate = (reduced: boolean): boolean => !reduced;
export const shouldCelebrate = (reduced: boolean, enabled: boolean, force = false): boolean =>
	shouldAnimate(reduced) && (enabled || force);

export function makeParticles(kind: Celebration, x: number, y: number, random = Math.random) {
	return Array.from({ length: kind === 'pass' ? 18 : 64 }, () => ({
		x, y,
		vx: (random() - 0.5) * 360,
		vy: -140 - random() * 180,
		size: 3 + random() * 3,
		angle: random() * Math.PI * 2,
	}));
}

/** Pointer position inside the element (0–1 on each axis) → tilt in degrees: 0 in the middle, ±max at the edges. */
export function tiltAngles(relX: number, relY: number, max = 3): { x: number; y: number } {
	const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
	return { x: (clamp(relX) - 0.5) * 2 * max, y: (0.5 - clamp(relY)) * 2 * max };
}
