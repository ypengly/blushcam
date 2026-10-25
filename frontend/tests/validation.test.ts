import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmail, validatePassword, validateRegister, validateLogin, safeNext } from '../lib/validation.ts';

test('email validation', () => { assert.equal(validateEmail('a@b.co'), null); for (const bad of ['', 'a', 'a@b', 'a b@c.de', 'a@@b.com']) assert.ok(validateEmail(bad), bad); });
test('password rules', () => { assert.ok(validatePassword('short1')); assert.ok(validatePassword('onlyletterslong')); assert.ok(validatePassword('1234567890123')); assert.equal(validatePassword('blush-cam-2026'), null); assert.ok(validatePassword('a1'.repeat(70))); });
test('register form errors are per-field', () => {
  assert.deepEqual(Object.keys(validateRegister({ email: 'x', password: 'short', confirm: '' })).sort(), ['email', 'password']);
  assert.deepEqual(validateRegister({ email: 'a@b.co', password: 'blush-cam-2026', confirm: 'nope' }), { confirm: 'Passwords don’t match.' });
  assert.deepEqual(validateRegister({ email: 'a@b.co', password: 'blush-cam-2026', confirm: 'blush-cam-2026' }), {});
});
test('login form', () => { assert.deepEqual(Object.keys(validateLogin({ email: '', password: '' })).sort(), ['email', 'password']); assert.deepEqual(validateLogin({ email: 'a@b.co', password: 'x' }), {}); });
test('safeNext blocks open redirects', () => {
  assert.equal(safeNext('/gallery'), '/gallery'); assert.equal(safeNext('//evil.com'), '/dashboard'); assert.equal(safeNext('https://evil.com'), '/dashboard'); assert.equal(safeNext('/\\evil.com'), '/dashboard'); assert.equal(safeNext(null), '/dashboard'); assert.equal(safeNext('/a\nb'), '/dashboard');
});
