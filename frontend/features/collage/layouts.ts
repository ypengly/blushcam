import { newDoc, photoLayer, DEFAULT_CROP } from '../../lib/editor/model.ts';
import type { Background, Doc, PhotoLayer } from '../../lib/editor/model.ts';

export type CollageLayoutId = 'two' | 'three' | 'grid4' | 'grid6' | 'grid9' | 'magazine' | 'polaroid' | 'scrapbook' | 'filmstrip' | 'freeform';
export interface Slot { x: number; y: number; w: number; h: number; rotation?: number } // normalised 0..1 of the inner area
export const COLLAGE_ASPECTS = [
  { id: '1:1', label: 'Square 1:1', w: 1080, h: 1080 }, { id: '4:5', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { id: '9:16', label: 'Story 9:16', w: 1080, h: 1920 }, { id: '16:9', label: 'Wide 16:9', w: 1920, h: 1080 }, { id: '3:2', label: 'Print 3:2', w: 1800, h: 1200 },
] as const;

const grid = (cols: number, rows: number): Slot[] => {
  const s: Slot[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
  return s;
};

export const COLLAGE_LAYOUTS: Record<CollageLayoutId, { label: string; slots: (landscape: boolean) => Slot[]; polaroid?: boolean; gapScale?: number }> = {
  two: { label: 'Two photos', slots: (l) => (l ? grid(2, 1) : grid(1, 2)) },
  three: { label: 'Three photos', slots: (l) => (l ? [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] : [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }]) },
  grid4: { label: 'Four grid', slots: () => grid(2, 2) },
  grid6: { label: 'Six grid', slots: (l) => (l ? grid(3, 2) : grid(2, 3)) },
  grid9: { label: 'Nine grid', slots: () => grid(3, 3) },
  magazine: { label: 'Magazine', slots: (l) => (l
    ? [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.25, h: 0.5 }, { x: 0.75, y: 0, w: 0.25, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }]
    : [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.25 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.25 }, { x: 0, y: 0.75, w: 1, h: 0.25 }]) },
  polaroid: { label: 'Polaroids', polaroid: true, slots: () => [
    { x: 0.04, y: 0.05, w: 0.42, h: 0.42, rotation: -5 }, { x: 0.52, y: 0.07, w: 0.42, h: 0.42, rotation: 4 },
    { x: 0.08, y: 0.53, w: 0.42, h: 0.42, rotation: 3 }, { x: 0.54, y: 0.51, w: 0.42, h: 0.42, rotation: -4 }] },
  scrapbook: { label: 'Scrapbook', polaroid: true, slots: () => [
    { x: 0.05, y: 0.04, w: 0.5, h: 0.4, rotation: -4 }, { x: 0.48, y: 0.2, w: 0.46, h: 0.36, rotation: 5 },
    { x: 0.06, y: 0.5, w: 0.4, h: 0.34, rotation: 3 }, { x: 0.5, y: 0.62, w: 0.42, h: 0.32, rotation: -3 }] },
  filmstrip: { label: 'Film strip', slots: (l) => (l ? [0, 1, 2, 3].map((i) => ({ x: i / 4 + 0.01, y: 0.12, w: 0.23, h: 0.76 })) : [0, 1, 2, 3].map((i) => ({ x: 0.12, y: i / 4 + 0.01, w: 0.76, h: 0.23 }))), gapScale: 0 },
  freeform: { label: 'Freeform', slots: () => [
    { x: 0.04, y: 0.06, w: 0.5, h: 0.42, rotation: -3 }, { x: 0.46, y: 0.1, w: 0.48, h: 0.38, rotation: 4 },
    { x: 0.08, y: 0.5, w: 0.4, h: 0.44, rotation: 2 }, { x: 0.44, y: 0.52, w: 0.5, h: 0.4, rotation: -5 }, { x: 0.3, y: 0.3, w: 0.36, h: 0.3, rotation: 6 }] },
};

export interface CollageStyle { spacing: number; radius: number; borderWidth: number; borderColor: string; shadow: boolean }
export const DEFAULT_COLLAGE_STYLE: CollageStyle = { spacing: 16, radius: 12, borderWidth: 0, borderColor: '#FFFFFF', shadow: false };

export function collageSlotRects(layoutId: CollageLayoutId, width: number, height: number, style: CollageStyle): Array<{ x: number; y: number; w: number; h: number; rotation: number }> {
  const L = COLLAGE_LAYOUTS[layoutId];
  const margin = style.spacing;
  const gap = L.gapScale === 0 ? 0 : style.spacing;
  const iw = width - margin * 2, ih = height - margin * 2;
  return L.slots(width >= height).map((s) => {
    const free = !!s.rotation || L.polaroid;
    const g = free ? 0 : gap / 2;
    return {
      x: Math.round(margin + s.x * iw + g), y: Math.round(margin + s.y * ih + g),
      w: Math.max(8, Math.round(s.w * iw - g * 2)), h: Math.max(8, Math.round(s.h * ih - g * 2)), rotation: s.rotation ?? 0,
    };
  });
}

export function buildCollageDoc(layoutId: CollageLayoutId, aspectId: string, photos: string[] = [], style: CollageStyle = DEFAULT_COLLAGE_STYLE, background: Background = { kind: 'solid', color: '#FFF9F3' }): Doc {
  const a = COLLAGE_ASPECTS.find((x) => x.id === aspectId) ?? COLLAGE_ASPECTS[0];
  const doc = newDoc('collage', a.w, a.h, background);
  doc.meta = { layout: layoutId, aspect: a.id };
  return relayoutCollage(doc, layoutId, style, photos.map((src) => ({ src, crop: { ...DEFAULT_CROP } })));
}

/**
 * Change layout (or style) WITHOUT losing photos: existing photo sources (plus spare ones) are re-mapped
 * to the new slots in order; extras are kept in `spare` and return when a layout with more slots is chosen.
 * Non-photo layers (text, stickers, shapes) are preserved.
 */
export function relayoutCollage(doc: Doc, layoutId: CollageLayoutId, style: CollageStyle, extra: Array<{ src: string; crop: PhotoLayer['crop'] }> = []): Doc {
  const L = COLLAGE_LAYOUTS[layoutId];
  const carried: Array<{ src: string; crop: PhotoLayer['crop'] }> = [];
  for (const l of doc.layers) if (l.kind === 'photo' && l.src) carried.push({ src: l.src, crop: l.crop });
  const pool = [...carried, ...(doc.spare ?? []), ...extra];
  const rects = collageSlotRects(layoutId, doc.width, doc.height, style);
  const others = doc.layers.filter((l) => l.kind !== 'photo');
  const slots = rects.map((r, i) => {
    const item = pool[i];
    return photoLayer({
      ...r, src: item?.src ?? null, crop: item?.crop ?? { ...DEFAULT_CROP }, radius: style.radius,
      border: { width: L.polaroid ? Math.max(style.borderWidth, 18) : style.borderWidth, color: L.polaroid ? '#FFFFFF' : style.borderColor }, shadow: style.shadow || !!L.polaroid,
    });
  });
  return { ...doc, layers: [...slots, ...others], spare: pool.slice(rects.length), meta: { ...doc.meta, layout: layoutId } };
}

/** Change aspect ratio keeping layout and photos. */
export function changeCollageAspect(doc: Doc, aspectId: string, style: CollageStyle): Doc {
  const a = COLLAGE_ASPECTS.find((x) => x.id === aspectId);
  if (!a) return doc;
  const next = { ...doc, width: a.w, height: a.h, meta: { ...doc.meta, aspect: a.id } };
  return relayoutCollage(next, (doc.meta?.layout ?? 'grid4') as CollageLayoutId, style);
}

/** Add one photo: fills the first empty slot, otherwise goes to `spare` (never silently dropped). */
export function addCollagePhoto(doc: Doc, src: string): Doc {
  const idx = doc.layers.findIndex((l) => l.kind === 'photo' && !l.src);
  if (idx >= 0) return { ...doc, layers: doc.layers.map((l, i) => (i === idx && l.kind === 'photo' ? { ...l, src, crop: { ...DEFAULT_CROP } } : l)) };
  return { ...doc, spare: [...(doc.spare ?? []), { src, crop: { ...DEFAULT_CROP } }] };
}

/** Swap the photos of two slots (drag-and-drop rearrange). */
export function swapCollageSlots(doc: Doc, idA: string, idB: string): Doc {
  const a = doc.layers.find((l) => l.id === idA), b = doc.layers.find((l) => l.id === idB);
  if (!a || !b || a.kind !== 'photo' || b.kind !== 'photo') return doc;
  return { ...doc, layers: doc.layers.map((l) => (l.id === idA ? { ...l, src: b.src, crop: b.crop } : l.id === idB ? { ...l, src: a.src, crop: a.crop } : l)) as Doc['layers'] };
}
