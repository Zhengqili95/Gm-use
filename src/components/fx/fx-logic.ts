export type Celebration = 'pass' | 'lesson';
export const FX_PARTICLES = false;
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
