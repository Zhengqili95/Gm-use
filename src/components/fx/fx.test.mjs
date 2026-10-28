import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FX_PARTICLES, shouldAnimate, shouldCelebrate, makeParticles, tiltAngles } from './fx-logic.ts';

test('reduced motion overrides both normal effects and forced celebrations', () => {
	assert.equal(shouldAnimate(true), false);
	assert.equal(shouldAnimate(false), true);
	for (const enabled of [false, true]) for (const force of [false, true]) {
		assert.equal(shouldCelebrate(true, enabled, force), false);
	}
});

test('particles are on for the lesson confetti (D-025); the switch still gates them and force overrides it', () => {
	assert.equal(FX_PARTICLES, true);
	assert.equal(shouldCelebrate(false, false), false);
	assert.equal(shouldCelebrate(false, false, true), true);
	assert.equal(shouldCelebrate(false, true), true);
});

test('tilt is level in the middle, capped at the edges, and ignores bad input', () => {
	assert.deepEqual(tiltAngles(0.5, 0.5, 3), { x: 0, y: 0 });
	assert.deepEqual(tiltAngles(1, 0, 3), { x: 3, y: 3 });
	assert.deepEqual(tiltAngles(0, 1, 3), { x: -3, y: -3 });
	assert.deepEqual(tiltAngles(5, -2, 3), { x: 3, y: 3 });
	assert.deepEqual(tiltAngles(Number.NaN, Number.POSITIVE_INFINITY, 3), { x: 0, y: 0 });
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
