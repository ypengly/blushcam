import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../lib/editor/model.ts';

test('history: commit/undo/redo and redo is cleared by new commit', () => {
  let h = M.createHistory(1);
  h = M.commit(h, 2); h = M.commit(h, 3);
  assert.equal(h.present, 3); h = M.undo(h); assert.equal(h.present, 2); h = M.undo(h); assert.equal(h.present, 1);
  assert.equal(M.canUndo(h), false); h = M.redo(h); assert.equal(h.present, 2);
  h = M.commit(h, 9); assert.equal(M.canRedo(h), false);
});
test('history: slider drags coalesce into one undo step', () => {
  let h = M.createHistory(0);
  for (let i = 1; i <= 10; i++) h = M.commit(h, i, 'brightness', 1000 + i * 10);
  assert.equal(h.present, 10); h = M.undo(h); assert.equal(h.present, 0);
});
test('history limit is enforced', () => {
  let h = M.createHistory(0); for (let i = 1; i < 250; i++) h = M.commit(h, i);
  assert.equal(h.past.length, M.HISTORY_LIMIT);
});
test('layer ops: add/update/remove/duplicate/reorder', () => {
  let d = M.newDoc('photo', 100, 100);
  const a = M.stickerLayer({ stickerId: 'heart', x: 0, y: 0, w: 10, h: 10 }), b = M.textLayer({ text: 'hi', x: 0, y: 0, w: 50 });
  d = M.addLayer(M.addLayer(d, a), b);
  d = M.updateLayer(d, a.id, { rotation: 45, opacity: 0.5 });
  assert.equal(d.layers[0].rotation, 45);
  d = M.moveLayer(d, a.id, 'front'); assert.equal(d.layers[1].id, a.id);
  d = M.moveLayer(d, a.id, 'backward'); assert.equal(d.layers[0].id, a.id);
  const dup = M.duplicateLayer(d, a.id); assert.equal(dup.doc.layers.length, 3); assert.notEqual(dup.newId, a.id);
  d = M.removeLayer(dup.doc, a.id); assert.equal(d.layers.length, 2);
});
test('project serialisation round-trips and rejects junk', () => {
  const p: M.Project = { id: 'p', name: 'x', type: 'photo', docs: [M.addLayer(M.newDoc('photo', 50, 60), M.textLayer({ text: 'a', x: 1, y: 2, w: 3 }))] };
  assert.deepEqual(M.parseProject(M.serializeProject(p)), p);
  assert.equal(M.parseProject('{"name":1}'), null); assert.equal(M.parseProject('not json'), null);
  assert.equal(M.parseProject(JSON.stringify({ name: 'x', docs: [{ version: 1, width: -1, height: 5, layers: [] }] })), null);
});
