import test from 'node:test';
import { photoSlots } from '../lib/editor/model.ts';
import assert from 'node:assert/strict';
import { BOOTH_LAYOUTS, BOOTH_THEMES, boothSlots, buildBoothDoc, restyleBoothDoc } from '../features/photo-booth/layouts.ts';
import { COLLAGE_LAYOUTS, buildCollageDoc, relayoutCollage, DEFAULT_COLLAGE_STYLE, addCollagePhoto, changeCollageAspect, swapCollageSlots } from '../features/collage/layouts.ts';
import { SCRAPBOOK_TEMPLATES, newScrapbook, addPage, deletePage, reorderPage, buildScrapbookPage } from '../features/scrapbook/templates.ts';
import { STICKERS, STICKER_COLLECTIONS, stickerSvg } from '../features/stickers/catalog.ts';

const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('booth: slot counts match layout and slots never overlap or leave the page', () => {
  for (const L of Object.values(BOOTH_LAYOUTS)) {
    const s = boothSlots(L); assert.equal(s.length, L.count, L.id);
    for (const a of s) { assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= L.width && a.y + a.h <= L.height, `${L.id} in bounds`); assert.ok(a.w > 0 && a.h > 0); }
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.equal(overlap(s[i], s[j]), false, `${L.id} ${i}/${j}`);
  }
});
test('booth: 14 themes; every theme builds a doc with caption and photo slots; four-cut is 600x1800', () => {
  assert.equal(BOOTH_THEMES.length, 14);
  for (const t of BOOTH_THEMES) { const d = buildBoothDoc('four', t.id, { date: '2026-10-18' }); assert.equal(photoSlots(d).length, 4); assert.ok(d.layers.some((l) => l.kind === 'text')); }
  const d = buildBoothDoc('four', 'coquette-pink'); assert.deepEqual([d.width, d.height], [600, 1800]);
});
test('booth: caption area does not collide with last photo; restyle keeps photos and filter', () => {
  const d = buildBoothDoc('four', 'korean-minimal', { photos: ['a', 'b', 'c', 'd'] });
  const lastBottom = Math.max(...photoSlots(d).map((p) => p.y + p.h)); const cap = d.layers.find((l) => l.kind === 'text')!; assert.ok(cap.y >= lastBottom);
  const d2 = restyleBoothDoc({ ...d, filter: { ...d.filter, presetId: 'blush' } }, 'cherry-blossom');
  assert.deepEqual(photoSlots(d2).map((p) => p.src), ['a', 'b', 'c', 'd']); assert.equal(d2.filter.presetId, 'blush'); assert.equal(d2.meta?.theme, 'cherry-blossom');
});
test('stickers: 12 collections, all non-empty and render valid svg for any colour', () => {
  assert.equal(STICKER_COLLECTIONS.length, 12);
  for (const c of STICKER_COLLECTIONS) assert.ok(STICKERS.some((s) => s.collection === c.id), c.id);
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, STICKERS.length);
  for (const s of STICKERS) { const svg = stickerSvg(s.id, '#123456')!; assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && !/NaN|undefined/.test(svg), s.id); }
  assert.equal(stickerSvg('nope'), null);
});
test('collage: all 10 layouts produce in-bounds slots', () => {
  assert.equal(Object.keys(COLLAGE_LAYOUTS).length, 10);
  for (const id of Object.keys(COLLAGE_LAYOUTS) as any[]) { const d = buildCollageDoc(id, '4:5', []); const s = photoSlots(d); assert.ok(s.length >= 2, id); for (const p of s) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= d.width + 1 && p.y + p.h <= d.height + 1, id); }
});
test('collage: switching layouts never loses photos (spare pool) and keeps text layers', () => {
  let d = buildCollageDoc('grid9', '1:1', ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  d = { ...d, layers: [...d.layers, { kind: 'text', id: 't', text: 'hi', x: 0, y: 0, w: 100, h: 50, rotation: 0, opacity: 1, fontFamily: 'x', fontSize: 20, fontWeight: 400, color: '#000', align: 'center' }] };
  d = relayoutCollage(d, 'two', DEFAULT_COLLAGE_STYLE);
  assert.equal(photoSlots(d).length, 2); assert.equal(d.spare!.length, 7); assert.ok(d.layers.some((l) => l.id === 't'));
  d = relayoutCollage(d, 'grid9', DEFAULT_COLLAGE_STYLE);
  assert.deepEqual(photoSlots(d).map((p) => p.src), ['1', '2', '3', '4', '5', '6', '7', '8', '9']); assert.equal(d.spare!.length, 0);
});
test('collage: add photo fills empty slot then spare; aspect change keeps photos; swap works', () => {
  let d = buildCollageDoc('two', '1:1', ['a']); d = addCollagePhoto(d, 'b'); assert.deepEqual(photoSlots(d).map((p) => p.src), ['a', 'b']);
  d = addCollagePhoto(d, 'c'); assert.equal(d.spare!.length, 1);
  d = changeCollageAspect(d, '9:16', DEFAULT_COLLAGE_STYLE); assert.deepEqual([d.width, d.height], [1080, 1920]); assert.deepEqual(photoSlots(d).map((p) => p.src), ['a', 'b']); assert.equal(d.spare!.length, 1);
  const [p1, p2] = photoSlots(d); d = swapCollageSlots(d, p1.id, p2.id); assert.deepEqual(photoSlots(d).map((p) => p.src), ['b', 'a']);
});
test('scrapbook: 8 templates build, page ops protect last page', () => {
  assert.equal(SCRAPBOOK_TEMPLATES.length, 8);
  for (const t of SCRAPBOOK_TEMPLATES) { const d = buildScrapbookPage(t.id); assert.ok(d.layers.length > 3 && photoSlots(d).length >= 2, t.id); }
  let p = newScrapbook('my-day'); p = addPage(p, 'love-story'); p = addPage(p, 'travel-journal'); assert.equal(p.docs.length, 3);
  p = reorderPage(p, 0, 2); assert.equal(p.docs[2].meta?.template, 'my-day');
  p = deletePage(p, 0); p = deletePage(p, 0); p = deletePage(p, 0); assert.equal(p.docs.length, 1);
});
