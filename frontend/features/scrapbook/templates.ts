import { newDoc, photoLayer, stickerLayer, textLayer, shapeLayer, addLayer } from '../../lib/editor/model.ts';
import type { Background, Doc, Project } from '../../lib/editor/model.ts';
import { uid } from '../../lib/editor/model.ts';

export const PAPER_STYLES: Record<string, Background> = {
  cream: { kind: 'solid', color: '#FFF9F3' },
  pink: { kind: 'solid', color: '#FCE4EC' },
  lavender: { kind: 'solid', color: '#E9DDFB' },
  mint: { kind: 'solid', color: '#DDF5E8' },
  dots: { kind: 'pattern', base: '#FFF9F3', pattern: 'dots', ink: '#F4C2D4' },
  grid: { kind: 'pattern', base: '#FFFFFF', pattern: 'grid', ink: '#E3D8EE' },
  stripes: { kind: 'pattern', base: '#FFF9F3', pattern: 'stripes', ink: '#F8D7E3' },
  kraft: { kind: 'pattern', base: '#EAD9C2', pattern: 'paper', ink: '#D8C3A5' },
};

export const SCRAPBOOK_PAGE = { width: 1080, height: 1440 } as const;
const hand = '"Caveat", "Comic Sans MS", cursive';
const serif = '"Playfair Display", Georgia, serif';

const polaroid = (x: number, y: number, w: number, rot: number) =>
  photoLayer({ x, y, w, h: w, rotation: rot, border: { width: 22, color: '#FFFFFF' }, shadow: true, radius: 2 });
const tape = (x: number, y: number, rot: number, color = '#F8BBD0') =>
  shapeLayer({ shape: 'tape', x, y, w: 170, h: 46, rotation: rot, fill: color, opacity: 0.8 });

interface Spec { id: string; name: string; audience: 'everyone' | 'solo' | 'friends' | 'couple' | 'family'; build: () => Doc }

function base(bg: Background): Doc { return newDoc('scrapbook', SCRAPBOOK_PAGE.width, SCRAPBOOK_PAGE.height, bg); }
function title(doc: Doc, t: string, sub = '', color = '#8E3B5C', font = hand): Doc {
  let d = addLayer(doc, textLayer({ text: t, x: 60, y: 70, w: 960, fontSize: 104, fontFamily: font, color, fontWeight: 700 }));
  if (sub) d = addLayer(d, textLayer({ text: sub, x: 60, y: 200, w: 960, fontSize: 40, fontFamily: font, color, fontWeight: 500, opacity: 0.8 }));
  return d;
}

export const SCRAPBOOK_TEMPLATES: Spec[] = [
  { id: 'my-day', name: 'My Day', audience: 'solo', build: () => {
    let d = title(base(PAPER_STYLES.dots), 'my day', 'today’s little things');
    d = addLayer(d, polaroid(90, 330, 420, -4)); d = addLayer(d, polaroid(560, 480, 420, 5)); d = addLayer(d, polaroid(130, 880, 380, 3));
    d = addLayer(d, tape(220, 310, -6)); d = addLayer(d, tape(700, 462, 8, '#E9DDFB'));
    d = addLayer(d, textLayer({ text: 'coffee, sunshine & good music ☕', x: 540, y: 960, w: 480, fontSize: 52, fontFamily: hand, align: 'left', rotation: -3 }));
    return addLayer(d, stickerLayer({ stickerId: 'sparkle-trio', x: 840, y: 40, w: 170, h: 170, color: '#D96C93' }));
  } },
  { id: 'summer-memories', name: 'Summer Memories', audience: 'everyone', build: () => {
    let d = title(base({ kind: 'gradient', from: '#FFF3CD', to: '#BEE6F5', angle: 170 }), 'summer memories', 'sun · sea · us', '#2F6A8A');
    d = addLayer(d, polaroid(80, 340, 460, -5)); d = addLayer(d, polaroid(540, 420, 440, 4)); d = addLayer(d, polaroid(300, 900, 440, -2));
    d = addLayer(d, stickerLayer({ stickerId: 'sun', x: 850, y: 40, w: 180, h: 180, color: '#FFB300' }));
    d = addLayer(d, stickerLayer({ stickerId: 'cloud', x: 40, y: 1160, w: 220, h: 220, color: '#FFFFFF' }));
    return addLayer(d, tape(190, 322, -8, '#FFE082'));
  } },
  { id: 'best-friend-diary', name: 'Best Friend Diary', audience: 'friends', build: () => {
    let d = title(base(PAPER_STYLES.mint), 'best friend diary', 'dear us,', '#3F6B58');
    d = addLayer(d, polaroid(70, 320, 440, -4)); d = addLayer(d, polaroid(570, 360, 440, 4));
    d = addLayer(d, textLayer({ text: 'things we always say:\n“one more photo?”', x: 90, y: 860, w: 900, fontSize: 56, fontFamily: hand, color: '#3F6B58', align: 'left', h: 200 }));
    d = addLayer(d, stickerLayer({ stickerId: 'heart', x: 880, y: 1100, w: 130, h: 130, color: '#F48FB1', rotation: 12 }));
    return addLayer(d, tape(220, 302, -5, '#FFD54F'));
  } },
  { id: 'love-story', name: 'Love Story', audience: 'couple', build: () => {
    let d = title(base({ kind: 'gradient', from: '#FFF1E6', to: '#F8BBD0', angle: 165 }), 'our love story', 'chapter one', '#8E3B5C', serif);
    d = addLayer(d, polaroid(100, 360, 440, -3)); d = addLayer(d, polaroid(540, 520, 440, 4));
    d = addLayer(d, stickerLayer({ stickerId: 'envelope', x: 70, y: 1000, w: 200, h: 200, color: '#D96C93', rotation: -8 }));
    d = addLayer(d, stickerLayer({ stickerId: 'heart-double', x: 820, y: 60, w: 190, h: 190, color: '#D96C93' }));
    return addLayer(d, textLayer({ text: 'and so it began…', x: 300, y: 1060, w: 700, fontSize: 64, fontFamily: hand, color: '#8E3B5C' }));
  } },
  { id: 'travel-journal', name: 'Travel Journal', audience: 'everyone', build: () => {
    let d = title(base(PAPER_STYLES.kraft), 'travel journal', 'where we went', '#5B4636');
    d = addLayer(d, polaroid(80, 330, 440, -3)); d = addLayer(d, polaroid(560, 390, 440, 3)); d = addLayer(d, polaroid(320, 880, 440, -2));
    d = addLayer(d, shapeLayer({ shape: 'rect', x: 70, y: 1180, w: 330, h: 120, fill: '#FFF9F3', radius: 6, rotation: -3, opacity: 0.95 }));
    d = addLayer(d, textLayer({ text: 'DAY 01 · CITY, COUNTRY', x: 80, y: 1210, w: 310, fontSize: 28, fontFamily: '"Courier New", monospace', color: '#5B4636', rotation: -3 }));
    return addLayer(d, tape(190, 312, -4, '#C9E4D4'));
  } },
  { id: 'birthday-memories', name: 'Birthday Memories', audience: 'everyone', build: () => {
    let d = title(base({ kind: 'gradient', from: '#FFF9C4', to: '#F8BBD0', angle: 160 }), 'happy birthday!', 'another year, more memories');
    d = addLayer(d, polaroid(90, 340, 440, -4)); d = addLayer(d, polaroid(560, 440, 420, 5));
    d = addLayer(d, stickerLayer({ stickerId: 'balloon', x: 900, y: 40, w: 150, h: 220, color: '#F48FB1' }));
    d = addLayer(d, stickerLayer({ stickerId: 'cake', x: 140, y: 920, w: 280, h: 280, color: '#F8BBD0' }));
    return addLayer(d, stickerLayer({ stickerId: 'party-hat', x: 700, y: 980, w: 200, h: 200, color: '#B79BE3', rotation: 12 }));
  } },
  { id: 'little-things', name: 'Little Things', audience: 'solo', build: () => {
    let d = title(base(PAPER_STYLES.cream), 'little things', 'that made me smile');
    const spots = [[80, 330, 300], [400, 360, 300], [720, 330, 280], [80, 700, 300], [400, 730, 300], [720, 700, 280]];
    spots.forEach(([x, y, w], i) => { d = addLayer(d, photoLayer({ x, y, w, h: w, rotation: (i % 2 ? 2 : -2), border: { width: 14, color: '#FFFFFF' }, shadow: true })); });
    d = addLayer(d, textLayer({ text: '1. sunny walks   2. warm tea   3. soft blankets', x: 70, y: 1100, w: 940, fontSize: 48, fontFamily: hand, color: '#8E3B5C' }));
    return addLayer(d, stickerLayer({ stickerId: 'flower-blossom', x: 860, y: 1200, w: 150, h: 150, color: '#F4A6C3' }));
  } },
  { id: 'monthly-photo-diary', name: 'Monthly Photo Diary', audience: 'everyone', build: () => {
    let d = title(base(PAPER_STYLES.grid), 'MONTH', 'one photo a week', '#352B35', serif);
    for (let i = 0; i < 4; i++) {
      const x = 70 + (i % 2) * 480, y = 330 + Math.floor(i / 2) * 520;
      d = addLayer(d, photoLayer({ x, y, w: 440, h: 440, border: { width: 14, color: '#FFFFFF' }, shadow: true, rotation: i % 2 ? 1.5 : -1.5 }));
      d = addLayer(d, textLayer({ text: `week ${i + 1}`, x, y: y + 446, w: 440, fontSize: 40, fontFamily: hand, color: '#847784' }));
    }
    return addLayer(d, tape(60, 318, -10, '#E9DDFB'));
  } },
];

export function buildScrapbookPage(templateId: string): Doc {
  const spec = SCRAPBOOK_TEMPLATES.find((t) => t.id === templateId) ?? SCRAPBOOK_TEMPLATES[0];
  const doc = spec.build();
  doc.meta = { template: spec.id };
  return doc;
}
export function newScrapbook(templateId = 'my-day', name = 'Untitled scrapbook'): Project {
  return { id: uid('proj'), name, type: 'scrapbook', docs: [buildScrapbookPage(templateId)] };
}

/* ---- page operations ---- */
export function addPage(p: Project, templateId = 'my-day'): Project { return { ...p, docs: [...p.docs, buildScrapbookPage(templateId)] }; }
export function deletePage(p: Project, index: number): Project {
  if (p.docs.length <= 1 || index < 0 || index >= p.docs.length) return p; // never delete the last page
  return { ...p, docs: p.docs.filter((_, i) => i !== index) };
}
export function reorderPage(p: Project, from: number, to: number): Project {
  if (from === to || from < 0 || to < 0 || from >= p.docs.length || to >= p.docs.length) return p;
  const docs = [...p.docs];
  const [m] = docs.splice(from, 1);
  docs.splice(to, 0, m);
  return { ...p, docs };
}
