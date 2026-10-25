import type { FilterState } from '../../features/filters/types.ts';
import { DEFAULT_FILTER_STATE } from '../../features/filters/presets.ts';

export type ProjectType = 'photo' | 'booth' | 'collage' | 'scrapbook';

interface LayerBase { id: string; x: number; y: number; w: number; h: number; rotation: number; opacity: number; locked?: boolean }

export interface PhotoLayer extends LayerBase {
  kind: 'photo';
  /** Key into the runtime image map; null = empty slot (placeholder in editor, skipped in export). */
  src: string | null;
  crop: { zoom: number; offsetX: number; offsetY: number }; // zoom >= 1; offsets -1..1
  radius: number;
  border: { width: number; color: string };
  shadow: boolean;
  /** Per-layer override; undefined = use document filter. */
  filter?: FilterState | null;
  mirror?: boolean;
}
export interface StickerLayer extends LayerBase { kind: 'sticker'; stickerId: string; color?: string }
export interface TextLayer extends LayerBase {
  kind: 'text'; text: string; fontFamily: string; fontSize: number; fontWeight: number; color: string; align: 'left' | 'center' | 'right';
}
export interface ShapeLayer extends LayerBase { kind: 'shape'; shape: 'rect' | 'tape'; fill: string; radius: number }
export type Layer = PhotoLayer | StickerLayer | TextLayer | ShapeLayer;

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'pattern'; base: string; pattern: 'dots' | 'grid' | 'stripes' | 'paper'; ink: string }
  | { kind: 'transparent' };

export interface Doc {
  version: 1;
  type: ProjectType;
  width: number;
  height: number;
  background: Background;
  filter: FilterState;
  layers: Layer[];
  /** Photos that don't fit the current collage layout; remapped when the layout changes. */
  spare?: Array<{ src: string; crop: PhotoLayer['crop'] }>;
  meta?: Record<string, string>;
}

export interface Project { id: string; name: string; type: ProjectType; docs: Doc[] }

let counter = 0;
export function uid(prefix = 'l'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_CROP = { zoom: 1, offsetX: 0, offsetY: 0 };

export function newDoc(type: ProjectType, width: number, height: number, background: Background = { kind: 'solid', color: '#FFF9F3' }): Doc {
  return { version: 1, type, width, height, background, filter: { ...DEFAULT_FILTER_STATE, adjust: {} }, layers: [] };
}

export function photoLayer(p: Partial<PhotoLayer> & Pick<PhotoLayer, 'x' | 'y' | 'w' | 'h'>): PhotoLayer {
  return { kind: 'photo', id: uid('p'), src: null, rotation: 0, opacity: 1, crop: { ...DEFAULT_CROP }, radius: 0, border: { width: 0, color: '#FFFFFF' }, shadow: false, ...p };
}
export function stickerLayer(p: Partial<StickerLayer> & Pick<StickerLayer, 'stickerId' | 'x' | 'y' | 'w' | 'h'>): StickerLayer {
  return { kind: 'sticker', id: uid('s'), rotation: 0, opacity: 1, ...p };
}
export function textLayer(p: Partial<TextLayer> & Pick<TextLayer, 'text' | 'x' | 'y' | 'w'>): TextLayer {
  return { kind: 'text', id: uid('t'), h: (p.fontSize ?? 48) * 1.3, rotation: 0, opacity: 1, fontFamily: 'Quicksand, system-ui, sans-serif', fontSize: 48, fontWeight: 600, color: '#352B35', align: 'center', ...p };
}
export function shapeLayer(p: Partial<ShapeLayer> & Pick<ShapeLayer, 'shape' | 'x' | 'y' | 'w' | 'h'>): ShapeLayer {
  return { kind: 'shape', id: uid('r'), rotation: 0, opacity: 1, fill: '#F8BBD0', radius: 0, ...p };
}

/* ---------- pure layer operations (return new docs) ---------- */

export function addLayer(doc: Doc, layer: Layer): Doc { return { ...doc, layers: [...doc.layers, layer] }; }
export function removeLayer(doc: Doc, id: string): Doc { return { ...doc, layers: doc.layers.filter((l) => l.id !== id) }; }
export function updateLayer<T extends Layer>(doc: Doc, id: string, patch: Partial<T>): Doc {
  return { ...doc, layers: doc.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) };
}
export function duplicateLayer(doc: Doc, id: string): { doc: Doc; newId: string | null } {
  const src = doc.layers.find((l) => l.id === id);
  if (!src) return { doc, newId: null };
  const copy = { ...structuredCloneSafe(src), id: uid(src.kind[0]), x: src.x + 24, y: src.y + 24 } as Layer;
  const idx = doc.layers.indexOf(src);
  const layers = [...doc.layers];
  layers.splice(idx + 1, 0, copy);
  return { doc: { ...doc, layers }, newId: copy.id };
}
export function moveLayer(doc: Doc, id: string, dir: 'forward' | 'backward' | 'front' | 'back'): Doc {
  const i = doc.layers.findIndex((l) => l.id === id);
  if (i < 0) return doc;
  const layers = [...doc.layers];
  const [item] = layers.splice(i, 1);
  const to = dir === 'forward' ? Math.min(layers.length, i + 1) : dir === 'backward' ? Math.max(0, i - 1) : dir === 'front' ? layers.length : 0;
  layers.splice(to, 0, item);
  return { ...doc, layers };
}

function structuredCloneSafe<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/** Assign photos (by image key) to empty/any photo slots in order. */
export function fillPhotoSlots(doc: Doc, srcs: string[], onlyEmpty = true): Doc {
  let n = 0;
  const layers = doc.layers.map((l) => {
    if (l.kind !== 'photo' || (onlyEmpty && l.src) || n >= srcs.length) return l;
    return { ...l, src: srcs[n++], crop: { ...DEFAULT_CROP } };
  });
  return { ...doc, layers };
}

export function photoSlots(doc: Doc): PhotoLayer[] { return doc.layers.filter((l): l is PhotoLayer => l.kind === 'photo'); }

/* ---------- undo / redo ---------- */

export interface History<T> { past: T[]; present: T; future: T[]; lastKey: string | null; lastAt: number }
export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> { return { past: [], present, future: [], lastKey: null, lastAt: 0 }; }

/** Commit a new state. Commits sharing `coalesceKey` within `windowMs` collapse into one undo step (slider drags, nudges). */
export function commit<T>(h: History<T>, next: T, coalesceKey: string | null = null, now = Date.now(), windowMs = 600): History<T> {
  if (next === h.present) return h;
  const coalesce = coalesceKey !== null && coalesceKey === h.lastKey && now - h.lastAt < windowMs && h.past.length > 0;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: coalesceKey, lastAt: now };
}
export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}
export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 };
}
export const canUndo = (h: History<unknown>) => h.past.length > 0;
export const canRedo = (h: History<unknown>) => h.future.length > 0;

/* ---------- (de)serialisation with validation ---------- */

export function serializeProject(p: Project): string { return JSON.stringify({ id: p.id, name: p.name, type: p.type, docs: p.docs }); }

export function isDoc(v: unknown): v is Doc {
  const d = v as Doc;
  return !!d && d.version === 1 && Number.isFinite(d.width) && Number.isFinite(d.height) && d.width > 0 && d.height > 0 && Array.isArray(d.layers);
}
export function parseProject(json: string): Project | null {
  try {
    const p = JSON.parse(json);
    if (!p || typeof p.name !== 'string' || !Array.isArray(p.docs) || p.docs.length === 0 || !p.docs.every(isDoc)) return null;
    return p as Project;
  } catch { return null; }
}
