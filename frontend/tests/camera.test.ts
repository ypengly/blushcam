import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraReducer as r, initialCameraState as s0, mapMediaError, videoConstraints, CAMERA_ERRORS } from '../features/camera/machine.ts';

test('happy path: idle → requesting → ready → capturing → reviewing → ready', () => {
  let s = r(s0, { type: 'REQUEST' }); assert.equal(s.status, 'requesting');
  s = r(s, { type: 'GRANTED' }); assert.equal(s.status, 'ready');
  s = r(s, { type: 'SHUTTER' }); assert.equal(s.status, 'capturing');
  s = r(s, { type: 'CAPTURED', url: 'blob:x' }); assert.equal(s.status, 'reviewing'); assert.equal(s.captured, 'blob:x');
  assert.equal(r(s, { type: 'RETAKE' }).status, 'ready');
});
test('timer counts down 3→2→1 then captures', () => {
  let s = r(r(s0, { type: 'REQUEST' }), { type: 'GRANTED' });
  s = r(s, { type: 'SET_TIMER', timer: 3 }); s = r(s, { type: 'SHUTTER' });
  assert.equal(s.status, 'countdown'); assert.equal(s.countdown, 3);
  s = r(s, { type: 'TICK' }); assert.equal(s.countdown, 2); s = r(s, { type: 'TICK' }); assert.equal(s.countdown, 1);
  s = r(s, { type: 'TICK' }); assert.equal(s.status, 'capturing');
});
test('illegal transitions are ignored', () => {
  assert.equal(r(s0, { type: 'SHUTTER' }), s0); assert.equal(r(s0, { type: 'GRANTED' }), s0); assert.equal(r(s0, { type: 'CAPTURED', url: 'x' }), s0);
});
test('permission denied/no device/in use map to clear errors; retry works', () => {
  assert.equal(mapMediaError({ name: 'NotAllowedError' }), 'denied'); assert.equal(mapMediaError({ name: 'NotFoundError' }), 'no-device');
  assert.equal(mapMediaError({ name: 'NotReadableError' }), 'in-use'); assert.equal(mapMediaError({ name: 'OverconstrainedError' }), 'constraints'); assert.equal(mapMediaError(null), 'unknown');
  let s = r(r(s0, { type: 'REQUEST' }), { type: 'FAILED', code: 'denied' });
  assert.equal(s.status, 'error'); assert.equal(s.error?.message, CAMERA_ERRORS.denied);
  assert.equal(r(s, { type: 'REQUEST' }).status, 'requesting');
});
test('stop and device-lost clear countdown; stop returns to idle', () => {
  let s = r(r(s0, { type: 'REQUEST' }), { type: 'GRANTED' }); s = r(r(s, { type: 'SET_TIMER', timer: 5 }), { type: 'SHUTTER' });
  assert.equal(r(s, { type: 'DEVICE_LOST' }).countdown, null); assert.equal(r(s, { type: 'STOP' }).status, 'idle');
});
test('constraints prefer exact device over facing mode', () => {
  assert.ok('facingMode' in videoConstraints({ facing: 'environment', deviceId: null, resolution: '720p' }));
  const c = videoConstraints({ facing: 'user', deviceId: 'abc', resolution: '1080p' }); assert.ok('deviceId' in c && !('facingMode' in c));
});
test('cancel during countdown returns to ready', () => {
  let s = r(r(s0, { type: 'REQUEST' }), { type: 'GRANTED' }); s = r(r(s, { type: 'SET_TIMER', timer: 3 }), { type: 'SHUTTER' });
  s = r(s, { type: 'CANCEL' }); assert.equal(s.status, 'ready'); assert.equal(s.countdown, null); assert.equal(r(s0, { type: 'CANCEL' }), s0);
});
