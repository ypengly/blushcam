import { newDoc, photoLayer, stickerLayer, textLayer, shapeLayer, fillPhotoSlots } from '../../lib/editor/model.ts';
import type { Background, Doc } from '../../lib/editor/model.ts';

export type BoothLayoutId = 'single' | 'two' | 'four' | 'six' | 'nine';

export interface BoothLayout {
  id: BoothLayoutId; label: string; count: number; cols: number; rows: number;
  width: number; height: number; slotAspect: number; /** w/h */ pad: number; gap: number; captionH: number;
}

export const BOOTH_LAYOUTS: Record<BoothLayoutId, BoothLayout> = {
  single: { id: 'single', label: 'Single', count: 1, cols: 1, rows: 1, width: 1080, height: 1440, slotAspect: 1, pad: 60, gap: 0, captionH: 240 },
  two: { id: 'two', label: 'Two-strip', count: 2, cols: 1, rows: 2, width: 600, height: 1200, slotAspect: 4 / 3, pad: 40, gap: 24, captionH: 120 },
  four: { id: 'four', label: 'Four-cut', count: 4, cols: 1, rows: 4, width: 600, height: 1800, slotAspect: 4 / 3, pad: 40, gap: 24, captionH: 128 },
  six: { id: 'six', label: 'Six-photo', count: 6, cols: 2, rows: 3, width: 1200, height: 1800, slotAspect: 1, pad: 50, gap: 24, captionH: 200 },
  nine: { id: 'nine', label: 'Nine grid', count: 9, cols: 3, rows: 3, width: 1500, height: 1800, slotAspect: 1, pad: 50, gap: 24, captionH: 170 },
};

export interface Deco { sticker: string; x: number; y: number; size: number; rotation: number; color?: string } // x,y,size in 0..1 of doc width/height
export interface BoothTheme {
  id: string; name: string; background: Background; ink: string; accent: string; fontFamily: string;
  radius: number; slotBorder: { width: number; color: string }; deco: Deco[]; defaultCaption: string;
}

const serif = '"Playfair Display", Georgia, serif';
const sans = 'Quicksand, system-ui, sans-serif';
const hand = '"Caveat", "Comic Sans MS", cursive';
const grad = (from: string, to: string, angle = 160): Background => ({ kind: 'gradient', from, to, angle });
const solid = (color: string): Background => ({ kind: 'solid', color });

export const BOOTH_THEMES: BoothTheme[] = [
  { id: 'coquette-pink', name: 'Coquette pink', background: grad('#FCE4EC', '#F8BBD0'), ink: '#8E3B5C', accent: '#D96C93', fontFamily: serif, radius: 18, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'little moments', deco: [{ sticker: 'bow-classic', x: 0.82, y: 0.02, size: 0.2, rotation: 12 }, { sticker: 'heart', x: 0.02, y: 0.88, size: 0.1, rotation: -14 }] },
  { id: 'korean-minimal', name: 'Korean minimalist', background: solid('#FFFFFF'), ink: '#352B35', accent: '#352B35', fontFamily: sans, radius: 0, slotBorder: { width: 0, color: '#FFFFFF' }, defaultCaption: 'BLUSHCAM', deco: [] },
  { id: 'y2k-silver', name: 'Y2K silver', background: grad('#F2F4F8', '#B9C2D3', 140), ink: '#3A4152', accent: '#7C88A6', fontFamily: sans, radius: 10, slotBorder: { width: 5, color: '#FFFFFF' }, defaultCaption: '✦ 2000s baby ✦', deco: [{ sticker: 'sparkle-trio', x: 0.74, y: 0.02, size: 0.22, rotation: 0, color: '#7C88A6' }, { sticker: 'star', x: 0.03, y: 0.9, size: 0.09, rotation: 15, color: '#9AA6C4' }] },
  { id: 'cherry-blossom', name: 'Cherry blossom', background: grad('#FFF3F7', '#F8C8DC'), ink: '#9C4468', accent: '#E58FB0', fontFamily: serif, radius: 20, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'spring days', deco: [{ sticker: 'flower-blossom', x: 0.78, y: 0.01, size: 0.2, rotation: 14, color: '#F4A6C3' }, { sticker: 'flower-blossom', x: 0.02, y: 0.9, size: 0.12, rotation: -20, color: '#F8BBD0' }, { sticker: 'flower-blossom', x: 0.88, y: 0.9, size: 0.08, rotation: 30, color: '#F4A6C3' }] },
  { id: 'bunny-cat', name: 'Bunny & cat', background: solid('#E9DDFB'), ink: '#5A4A78', accent: '#B79BE3', fontFamily: sans, radius: 24, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'best buddies', deco: [{ sticker: 'bunny-ears', x: 0.06, y: 0.0, size: 0.2, rotation: -8, color: '#FFFFFF' }, { sticker: 'cat-ears', x: 0.72, y: 0.005, size: 0.2, rotation: 8, color: '#FFFFFF' }] },
  { id: 'hearts-roses', name: 'Hearts & roses', background: grad('#F8BBD0', '#EC8FB0', 170), ink: '#FFFFFF', accent: '#FFFFFF', fontFamily: serif, radius: 16, slotBorder: { width: 7, color: '#FFFFFF' }, defaultCaption: 'with love', deco: [{ sticker: 'heart', x: 0.78, y: 0.02, size: 0.16, rotation: 14, color: '#FFFFFF' }, { sticker: 'heart-double', x: 0.02, y: 0.88, size: 0.14, rotation: -10, color: '#FFFFFF' }, { sticker: 'flower-blossom', x: 0.84, y: 0.9, size: 0.1, rotation: 0, color: '#D96C93' }] },
  { id: 'best-friends', name: 'Best friends', background: grad('#DDF5E8', '#FFF3C4', 150), ink: '#3F6B58', accent: '#79BFA0', fontFamily: hand, radius: 20, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'best friends forever', deco: [{ sticker: 'star', x: 0.78, y: 0.02, size: 0.15, rotation: 12, color: '#FFD54F' }, { sticker: 'heart', x: 0.03, y: 0.9, size: 0.1, rotation: -12, color: '#F48FB1' }] },
  { id: 'couple-memories', name: 'Couple memories', background: grad('#FFF1E6', '#F8BBD0', 160), ink: '#8E3B5C', accent: '#D96C93', fontFamily: serif, radius: 14, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'us, always', deco: [{ sticker: 'heart-double', x: 0.76, y: 0.02, size: 0.2, rotation: 8, color: '#D96C93' }, { sticker: 'envelope', x: 0.02, y: 0.88, size: 0.12, rotation: -8, color: '#D96C93' }] },
  { id: 'birthday', name: 'Birthday', background: grad('#FFF9C4', '#F8BBD0', 160), ink: '#8E3B5C', accent: '#D96C93', fontFamily: hand, radius: 20, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'happy birthday!', deco: [{ sticker: 'party-hat', x: 0.78, y: 0.0, size: 0.18, rotation: 14, color: '#B79BE3' }, { sticker: 'balloon', x: 0.02, y: 0.86, size: 0.12, rotation: -10, color: '#F48FB1' }, { sticker: 'cake', x: 0.84, y: 0.88, size: 0.12, rotation: 6, color: '#F8BBD0' }] },
  { id: 'summer-vacation', name: 'Summer vacation', background: grad('#FFF3CD', '#BEE6F5', 170), ink: '#2F6A8A', accent: '#F5A623', fontFamily: sans, radius: 18, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'summer ’26', deco: [{ sticker: 'sun', x: 0.76, y: 0.01, size: 0.2, rotation: 0, color: '#FFB300' }, { sticker: 'cloud', x: 0.02, y: 0.88, size: 0.14, rotation: 0, color: '#FFFFFF' }] },
  { id: 'christmas', name: 'Christmas', background: grad('#E8F5E9', '#FFEBEE', 160), ink: '#B23A48', accent: '#2E7D5B', fontFamily: serif, radius: 16, slotBorder: { width: 6, color: '#FFFFFF' }, defaultCaption: 'merry & bright', deco: [{ sticker: 'snowflake', x: 0.78, y: 0.01, size: 0.16, rotation: 0, color: '#8EC5E8' }, { sticker: 'snowflake', x: 0.03, y: 0.9, size: 0.1, rotation: 20, color: '#8EC5E8' }, { sticker: 'bow-classic', x: 0.82, y: 0.89, size: 0.12, rotation: 0, color: '#C62828' }] },
  { id: 'halloween', name: 'Halloween', background: grad('#3B2A4A', '#1F1830', 170), ink: '#FFB347', accent: '#FF8A3D', fontFamily: sans, radius: 12, slotBorder: { width: 6, color: '#FFB347' }, defaultCaption: 'spooky season', deco: [{ sticker: 'pumpkin', x: 0.76, y: 0.01, size: 0.2, rotation: 8, color: '#FF8A3D' }, { sticker: 'moon', x: 0.02, y: 0.88, size: 0.12, rotation: -10, color: '#FFE082' }] },
  { id: 'celestial-night', name: 'Celestial night', background: grad('#24225A', '#4B3C8F', 170), ink: '#E9DDFB', accent: '#C9B6FF', fontFamily: serif, radius: 16, slotBorder: { width: 5, color: '#C9B6FF' }, defaultCaption: 'under the stars', deco: [{ sticker: 'moon', x: 0.78, y: 0.01, size: 0.16, rotation: 0, color: '#FFF3B0' }, { sticker: 'sparkle-trio', x: 0.02, y: 0.88, size: 0.16, rotation: 0, color: '#E9DDFB' }, { sticker: 'star', x: 0.88, y: 0.9, size: 0.07, rotation: 20, color: '#FFF3B0' }] },
  { id: 'vintage-film', name: 'Vintage film', background: solid('#1C1A19'), ink: '#F4E6C8', accent: '#E0B96A', fontFamily: '"Courier New", monospace', radius: 4, slotBorder: { width: 0, color: '#000000' }, defaultCaption: 'ROLL 01 · 35MM', deco: [] },
];
export const BOOTH_THEME_BY_ID: Record<string, BoothTheme> = Object.fromEntries(BOOTH_THEMES.map((t) => [t.id, t]));

export interface BoothSlot { x: number; y: number; w: number; h: number }

/** Compute photo slot rectangles for a layout. Slots are centred inside the padded area and never overlap. */
export function boothSlots(layout: BoothLayout): BoothSlot[] {
  const availW = layout.width - layout.pad * 2;
  const availH = layout.height - layout.pad * 2 - layout.captionH;
  const cellW = (availW - layout.gap * (layout.cols - 1)) / layout.cols;
  const cellH = (availH - layout.gap * (layout.rows - 1)) / layout.rows;
  // fit the slot aspect inside each cell
  let w = cellW, h = cellW / layout.slotAspect;
  if (h > cellH) { h = cellH; w = cellH * layout.slotAspect; }
  const gridW = w * layout.cols + layout.gap * (layout.cols - 1);
  const gridH = h * layout.rows + layout.gap * (layout.rows - 1);
  const x0 = (layout.width - gridW) / 2;
  const y0 = layout.pad + (availH - gridH) / 2;
  const slots: BoothSlot[] = [];
  for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) {
    slots.push({ x: Math.round(x0 + c * (w + layout.gap)), y: Math.round(y0 + r * (h + layout.gap)), w: Math.round(w), h: Math.round(h) });
  }
  return slots;
}

export interface BoothOptions { caption?: string; date?: string | null; frameColor?: string | null; photos?: string[] }

export function buildBoothDoc(layoutId: BoothLayoutId, themeId: string, opts: BoothOptions = {}): Doc {
  const layout = BOOTH_LAYOUTS[layoutId];
  const theme = BOOTH_THEME_BY_ID[themeId] ?? BOOTH_THEMES[0];
  const bg: Background = opts.frameColor ? { kind: 'solid', color: opts.frameColor } : theme.background;
  let doc = newDoc('booth', layout.width, layout.height, bg);
  doc.meta = { layout: layoutId, theme: theme.id };
  for (const s of boothSlots(layout)) {
    doc.layers.push(photoLayer({ ...s, radius: theme.radius, border: { ...theme.slotBorder }, shadow: theme.slotBorder.width > 0 && theme.id !== 'celestial-night' }));
  }
  for (const d of theme.deco) {
    const size = d.size * layout.width;
    doc.layers.push(stickerLayer({ stickerId: d.sticker, x: d.x * layout.width, y: d.y * layout.height, w: size, h: size, rotation: d.rotation, color: d.color ?? theme.accent }));
  }
  const capTop = layout.height - layout.pad - layout.captionH + 16;
  const caption = opts.caption ?? theme.defaultCaption;
  const fs = Math.round(layout.width * (layout.cols > 1 ? 0.04 : 0.075));
  if (caption) doc.layers.push(textLayer({ text: caption, x: layout.pad, y: capTop, w: layout.width - layout.pad * 2, fontSize: fs, fontFamily: theme.fontFamily, color: theme.ink, fontWeight: 700 }));
  if (opts.date) doc.layers.push(textLayer({ text: opts.date, x: layout.pad, y: capTop + fs * 1.5, w: layout.width - layout.pad * 2, fontSize: Math.round(fs * 0.6), fontFamily: theme.fontFamily, color: theme.ink, fontWeight: 500, opacity: 0.8 }));
  if (opts.photos?.length) doc = fillPhotoSlots(doc, opts.photos, false);
  return doc;
}

/** Apply a new theme to an existing booth doc while keeping photos and captions. */
export function restyleBoothDoc(old: Doc, themeId: string, opts: BoothOptions = {}): Doc {
  const layoutId = (old.meta?.layout ?? 'four') as BoothLayoutId;
  const photos = old.layers.filter((l) => l.kind === 'photo').map((l) => (l.kind === 'photo' ? l.src : null));
  const caption = old.layers.find((l) => l.kind === 'text');
  const fresh = buildBoothDoc(layoutId, themeId, { caption: opts.caption ?? (caption && caption.kind === 'text' ? caption.text : undefined), date: opts.date, frameColor: opts.frameColor });
  fresh.filter = old.filter;
  let n = 0;
  fresh.layers = fresh.layers.map((l) => (l.kind === 'photo' ? { ...l, src: photos[n++] ?? null } : l));
  return fresh;
}
export { shapeLayer };
