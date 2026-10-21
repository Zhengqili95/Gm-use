import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FX_PARTICLES, shouldAnimate, shouldCelebrate, makeParticles } from './fx-logic.ts';

test('reduced motion overrides both normal effects and forced celebrations', () => {
	assert.equal(shouldAnimate(true), false);
	assert.equal(shouldAnimate(false), true);
	for (const enabled of [false, true]) for (const force of [false, true]) {
		assert.equal(shouldCelebrate(true, enabled, force), false);
	}
});

test('particles are opt-in and force only overrides the feature switch', () => {
	assert.equal(FX_PARTICLES, false);
	assert.equal(shouldCelebrate(false, FX_PARTICLES), false);
	assert.equal(shouldCelebrate(false, FX_PARTICLES, true), true);
	assert.equal(shouldCelebrate(false, true), true);
});

test('bursts respect their caps and begin at the supplied origin', () => {
	for (const [kind, cap] of [['pass', 20], ['lesson', 80]]) {
		const particles = makeParticles(kind, 42, 80, () => 0.5);
		assert.ok(particles.length > 0 && particles.length <= cap);
		for (const p of particles) {
			assert.equal(p.x, 42);
			assert.equal(p.y, 80);
			assert.ok(p.vy < 0);
			for (const value of Object.values(p)) assert.ok(Number.isFinite(value));
		}
	}
});

test('injected randomness makes generation reproducible, including endpoints', () => {
	assert.deepEqual(makeParticles('pass', 1, 2, () => 0.25), makeParticles('pass', 1, 2, () => 0.25));
	assert.notDeepEqual(makeParticles('pass', 1, 2, () => 0), makeParticles('pass', 1, 2, () => 1));
});
