import test from 'node:test';
import assert from 'node:assert/strict';
import { FILTER_PRESETS, FILTER_CATEGORIES, resolveParams, DEFAULT_FILTER_STATE, NEUTRAL, isNeutral, PRESET_BY_ID } from '../features/filters/presets.ts';
import { applyFilterToImageData, boxBlur, mulberry32 } from '../features/filters/engine.ts';
import { solidImage } from './helpers.ts';

const px = (d: Uint8ClampedArray, i = 0) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];

test('all 7 categories and 34 spec presets exist with unique ids', () => {
  assert.equal(FILTER_CATEGORIES.length, 7);
  assert.equal(FILTER_PRESETS.length, 34);
  assert.equal(new Set(FILTER_PRESETS.map((p) => p.id)).size, FILTER_PRESETS.length);
  const counts: Record<string, number> = {};
  for (const p of FILTER_PRESETS) counts[p.category] = (counts[p.category] ?? 0) + 1;
  assert.deepEqual(counts, { natural: 5, coquette: 5, y2k: 5, vintage: 5, dreamy: 5, romantic: 5, celestial: 4 });
});

test('every preset changes pixels of a mid-grey test image', () => {
  for (const p of FILTER_PRESETS) {
    const img = solidImage(32, 32, [140, 120, 110]);
    const before = [...img.data];
    const params = resolveParams({ ...DEFAULT_FILTER_STATE, presetId: p.id });
    applyFilterToImageData(img.data, 32, 32, params);
    assert.notDeepEqual([...img.data], before, `${p.id} left the image unchanged`);
  }
});

test('strength 0 is identity, strength scales effect monotonically', () => {
  const run = (strength: number) => {
    const img = solidImage(16, 16, [120, 120, 120]);
    applyFilterToImageData(img.data, 16, 16, resolveParams({ ...DEFAULT_FILTER_STATE, presetId: 'warm-glow', strength }));
    return img.data[0] - img.data[2]; // red minus blue = warmth
  };
  assert.equal(isNeutral(resolveParams({ ...DEFAULT_FILTER_STATE, presetId: 'warm-glow', strength: 0 })), true);
  assert.ok(run(0) === 0 && run(50) > 0 && run(100) > run(50));
});

test('brightness, contrast, saturation, temperature, tint adjust as documented', () => {
  const go = (adjust: any, rgb: [number, number, number] = [100, 120, 140]) => {
    const img = solidImage(8, 8, rgb);
    applyFilterToImageData(img.data, 8, 8, resolveParams({ ...DEFAULT_FILTER_STATE, adjust }));
    return px(img.data);
  };
  assert.ok(go({ brightness: 30 })[0] > 100);
  assert.ok(go({ brightness: -30 })[0] < 100);
  const hi = go({ contrast: 50 }, [200, 200, 200])[0], lo = go({ contrast: -50 }, [200, 200, 200])[0];
  assert.ok(hi > 200 - 1 && lo < 200);
  const desat = go({ saturation: -100 }); assert.ok(Math.abs(desat[0] - desat[2]) <= 1);
  const warm = go({ temperature: 60 }); assert.ok(warm[0] > 100 && warm[2] < 140);
  const mag = go({ tint: 60 }); assert.ok(mag[1] < 120);
});

test('vignette darkens corners but not centre; grain is deterministic', () => {
  const img = solidImage(40, 40, [200, 200, 200]);
  applyFilterToImageData(img.data, 40, 40, { ...NEUTRAL, vignette: 100 });
  assert.ok(img.data[0] < 190, 'corner darker'); assert.equal(img.data[(20 * 40 + 20) * 4], 200);
  const a = solidImage(20, 20, [128, 128, 128]), b = solidImage(20, 20, [128, 128, 128]);
  applyFilterToImageData(a.data, 20, 20, { ...NEUTRAL, grain: 60 }, { seed: 7 }); applyFilterToImageData(b.data, 20, 20, { ...NEUTRAL, grain: 60 }, { seed: 7 });
  assert.deepEqual([...a.data], [...b.data]); assert.notEqual(new Set(a.data).size, 1);
  const r = mulberry32(1); assert.ok(r() >= 0 && r() < 1);
});

test('fade lifts blacks; light leak adds warm light at top-right', () => {
  const f = solidImage(8, 8, [0, 0, 0]); applyFilterToImageData(f.data, 8, 8, { ...NEUTRAL, fade: 100 }); assert.ok(f.data[0] > 30);
  const l = solidImage(40, 40, [60, 60, 60]); applyFilterToImageData(l.data, 40, 40, { ...NEUTRAL, lightLeak: 100 });
  assert.ok(l.data[(0 * 40 + 39) * 4] > l.data[(39 * 40) * 4], 'top-right brighter than bottom-left');
});

test('blur/glow: boxBlur smooths an edge', () => {
  const w = 20, h = 4, img = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < 10; x++) { const i = (y * w + x) * 4; img[i] = img[i + 1] = img[i + 2] = 0; }
  const out = boxBlur(img, w, h, 3);
  const edge = out[(1 * w + 9) * 4]; assert.ok(edge > 0 && edge < 255);
});

test('preset data is structured: id, category, name, params, thumbCss, effects', () => {
  const p = PRESET_BY_ID['fairy-glow'];
  assert.ok(p.id && p.category === 'dreamy' && p.name && p.params && p.thumbCss.includes('brightness') && p.effects.includes('glow'));
});
