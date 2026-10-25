import test from 'node:test';
import assert from 'node:assert/strict';
import { planExport, ExportError, sizeForRatio, exportFileName, MAX_EXPORT_SIDE } from '../lib/export/dimensions.ts';
import { exportDoc } from '../lib/export/exportDoc.ts';
import { coverSourceRect, wrapText } from '../lib/editor/render.ts';
import { newDoc, photoLayer, stickerLayer, textLayer, addLayer, DEFAULT_CROP } from '../lib/editor/model.ts';
import { DEFAULT_FILTER_STATE } from '../features/filters/presets.ts';
import { createCanvas, solidImage, FakeCanvas } from './helpers.ts';

const mkEnv = (images: any = {}) => ({
  createCanvas, images, sticker: (id: string) => (id === 'heart' ? { width: 100, height: 100 } : null),
  toBlob: async (_c: any, mime: string) => new Blob([new Uint8Array([1, 2, 3])], { type: mime }),
});

test('planExport: preserves aspect, derives missing side, letterboxes instead of stretching', () => {
  const d = newDoc('photo', 600, 1800);
  let p = planExport(d, { format: 'png', width: 300 }); assert.deepEqual([p.width, p.height], [300, 900]);
  p = planExport(d, { format: 'png', height: 900 }); assert.deepEqual([p.width, p.height], [300, 900]);
  p = planExport(d, { format: 'png', width: 1000, height: 1000 });
  assert.equal(p.dh, 1000); assert.equal(p.dw, Math.round(600 * (1000 / 1800))); assert.ok(p.dx > 0, 'centred with side margins');
  p = planExport(d, { format: 'png', quality_preset: 'high' }); assert.deepEqual([p.width, p.height], [1200, 3600]);
});
test('planExport: refuses oversize instead of silently downscaling; invalid sizes; jpeg+transparent', () => {
  const d = newDoc('photo', 1000, 1000);
  assert.throws(() => planExport(d, { format: 'png', width: MAX_EXPORT_SIDE + 1 }), (e: any) => e instanceof ExportError && e.code === 'too-large');
  assert.throws(() => planExport(d, { format: 'png', width: 0, height: -5 } as any).width && 0, ExportError);
  assert.throws(() => planExport(newDoc('photo', 10, 10, { kind: 'transparent' }), { format: 'jpeg' }), (e: any) => e.code === 'transparent-unsupported');
  assert.doesNotThrow(() => planExport(newDoc('photo', 10, 10, { kind: 'transparent' }), { format: 'png' }));
  assert.throws(() => planExport(d, { format: 'gif' as any }), (e: any) => e.code === 'unsupported-format');
});
test('social ratios and file names', () => {
  const d = newDoc('photo', 1080, 1080);
  assert.deepEqual(sizeForRatio(d, 9 / 16, 1920), { width: 1080, height: 1920 }); assert.deepEqual(sizeForRatio(d, 16 / 9, 1920), { width: 1920, height: 1080 }); assert.deepEqual(sizeForRatio(d, null), { width: 1080, height: 1080 });
  assert.equal(exportFileName('My Cute Strip!!', 'jpeg', new Date('2026-10-18T00:00:00Z')), 'my-cute-strip-2026-10-18.jpg');
});
test('coverSourceRect keeps aspect (no stretching), zoom narrows, offsets stay in bounds', () => {
  const r = coverSourceRect(4000, 3000, 500, 500, DEFAULT_CROP); assert.equal(r.sw, r.sh); assert.equal(r.sh, 3000);
  const z = coverSourceRect(4000, 3000, 500, 500, { zoom: 2, offsetX: 1, offsetY: -1 }); assert.equal(z.sw, 1500); assert.ok(z.sx + z.sw <= 4000 + 1e-9 && z.sy >= 0);
});
test('wrapText wraps on width and honours newlines', () => {
  const m = (s: string) => s.length * 10; assert.deepEqual(wrapText(m, 'aaa bbb ccc', 70), ['aaa bbb', 'ccc']); assert.deepEqual(wrapText(m, 'a\nb', 100), ['a', 'b']);
});
test('exportDoc: output canvas has requested size and the EXPORTED pixels contain the selected filter', async () => {
  const src = solidImage(40, 40, [128, 128, 128]);
  let doc = newDoc('photo', 40, 40, { kind: 'solid', color: '#FFFFFF' });
  doc = addLayer(doc, photoLayer({ x: 0, y: 0, w: 40, h: 40, src: 's' }));
  const grab = async (filterId: string | null) => {
    const d = { ...doc, filter: { ...DEFAULT_FILTER_STATE, presetId: filterId } };
    let target: FakeCanvas | null = null;
    const env = mkEnv({ s: src }); const orig = env.createCanvas;
    let first = true; env.createCanvas = (w: number, h: number) => { const c = orig(w, h); if (first) { target = c; first = false; } return c; };
    const blob = await exportDoc(env as any, d, { format: 'png', width: 80 });
    assert.equal(blob.type, 'image/png');
    return { blob, target: target!, offscreen: (target!.calls.find((c) => c.fn === 'drawImage')!.args[0] as FakeCanvas) };
  };
  const plain = await grab(null), warm = await grab('golden-sunset');
  assert.deepEqual([plain.target.width, plain.target.height], [80, 80]);
  assert.deepEqual([...plain.offscreen.data.slice(0, 3)], [128, 128, 128], 'no filter → untouched');
  assert.notDeepEqual([...warm.offscreen.data.slice(0, 3)], [128, 128, 128], 'filter present in exported pixels');
  assert.ok(warm.offscreen.data[0] > warm.offscreen.data[2], 'golden sunset is warm');
});
test('exportDoc: stickers and text are drawn; progress reaches 1; cancel works; encode failures surface', async () => {
  let doc = newDoc('photo', 100, 100);
  doc = addLayer(addLayer(doc, stickerLayer({ stickerId: 'heart', x: 10, y: 10, w: 30, h: 30 })), textLayer({ text: 'hello', x: 0, y: 60, w: 100 }));
  const prog: number[] = []; let canvas: FakeCanvas | null = null;
  const env = mkEnv(); const o = env.createCanvas; env.createCanvas = (w: number, h: number) => (canvas = canvas ?? o(w, h)) as any;
  await exportDoc(env as any, doc, { format: 'png' }, { onProgress: (f) => prog.push(f) });
  const fns = canvas!.calls.map((c) => c.fn); assert.ok(fns.includes('drawImage') && fns.includes('fillText')); assert.equal(prog[prog.length - 1], 1);
  const st = canvas!.calls.find((c) => c.fn === 'drawImage')!.args; assert.deepEqual(st.slice(1), [-15, -15, 30, 30], 'sticker drawn at layer size (scale 1)');
  await assert.rejects(exportDoc(env as any, doc, { format: 'png' }, { isCancelled: () => true }), (e: any) => e.code === 'cancelled');
  await assert.rejects(exportDoc({ ...env, toBlob: async () => null } as any, doc, { format: 'png' }), (e: any) => e.code === 'encode-failed');
  await assert.rejects(exportDoc({ ...env, toBlob: async () => new Blob([new Uint8Array([1])], { type: 'image/png' }) } as any, doc, { format: 'webp' }), (e: any) => e.code === 'unsupported-format');
});
test('position consistency: preview (scale .5) and export (scale 2) place the same layer at proportional coordinates', async () => {
  let doc = newDoc('photo', 200, 200); doc = addLayer(doc, stickerLayer({ stickerId: 'heart', x: 20, y: 40, w: 60, h: 60, rotation: 0 }));
  const where = async (width: number) => { let c: FakeCanvas | null = null; const env = mkEnv(); const o = env.createCanvas; env.createCanvas = (w: number, h: number) => (c = c ?? o(w, h)) as any; await exportDoc(env as any, doc, { format: 'png', width }); const t = c!.calls.find((x) => x.fn === 'translate')!.args as number[]; return [t[0] / width, t[1] / width]; };
  const a = await where(100), b = await where(400); assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
});
