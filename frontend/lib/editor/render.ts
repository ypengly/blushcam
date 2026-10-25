import type { Background, Doc, Layer, PhotoLayer, TextLayer } from './model.ts';
import { applyFilterToImageData } from '../../features/filters/engine.ts';
import { isNeutral, resolveParams } from '../../features/filters/presets.ts';
import type { ExportPlan } from '../export/dimensions.ts';

/** Minimal structural types so the renderer runs against real canvases AND test doubles. */
export type Ctx = any;
export interface RenderEnv {
  createCanvas(w: number, h: number): { width: number; height: number; getContext(t: '2d', o?: unknown): Ctx };
  /** Decoded source photos keyed by PhotoLayer.src. */
  images: Record<string, { width: number; height: number }>;
  /** Rasterised sticker for (id,color); must be preloaded. */
  sticker(id: string, color?: string): { width: number; height: number } | null;
  /** Show dashed placeholders for empty photo slots (editor preview only). */
  placeholders?: boolean;
}

export interface RenderHooks { onLayer?: (done: number, total: number) => void; isCancelled?: () => boolean }

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Source rect for "cover" fit with zoom + offsets. Pure → unit-testable. */
export function coverSourceRect(imgW: number, imgH: number, boxW: number, boxH: number, crop: PhotoLayer['crop']) {
  const zoom = Math.max(1, crop.zoom);
  const boxRatio = boxW / boxH;
  let sw = imgW, sh = imgH;
  if (imgW / imgH > boxRatio) sw = imgH * boxRatio; else sh = imgW / boxRatio;
  sw /= zoom; sh /= zoom;
  const maxX = imgW - sw, maxY = imgH - sh;
  const sx = maxX / 2 + (Math.max(-1, Math.min(1, crop.offsetX)) * maxX) / 2;
  const sy = maxY / 2 + (Math.max(-1, Math.min(1, crop.offsetY)) * maxY) / 2;
  return { sx, sy, sw, sh };
}

function paintBackground(ctx: Ctx, bg: Background, x: number, y: number, w: number, h: number, scale: number) {
  if (bg.kind === 'transparent') return;
  if (bg.kind === 'solid') { ctx.fillStyle = bg.color; ctx.fillRect(x, y, w, h); return; }
  if (bg.kind === 'gradient') {
    const a = (bg.angle * Math.PI) / 180, cx = x + w / 2, cy = y + h / 2, len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    const dx = (Math.sin(a) * len) / 2, dy = (-Math.cos(a) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); return;
  }
  ctx.fillStyle = bg.base; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = bg.ink; ctx.strokeStyle = bg.ink; ctx.lineWidth = Math.max(1, 2 * scale);
  const step = 48 * scale;
  if (bg.pattern === 'dots') { for (let yy = y + step / 2; yy < y + h; yy += step) for (let xx = x + step / 2; xx < x + w; xx += step) { ctx.beginPath(); ctx.arc(xx, yy, 4 * scale, 0, Math.PI * 2); ctx.fill(); } }
  else if (bg.pattern === 'grid') { ctx.beginPath(); for (let xx = x; xx <= x + w; xx += step) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); } for (let yy = y; yy <= y + h; yy += step) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } ctx.stroke(); }
  else if (bg.pattern === 'stripes') { ctx.globalAlpha = 0.55; for (let xx = x; xx < x + w; xx += step) ctx.fillRect(xx, y, step / 2, h); }
  else { ctx.globalAlpha = 0.35; let s = 7; for (let i = 0; i < 700; i++) { s = (s * 16807) % 2147483647; const px = x + (s % 10000) / 10000 * w; s = (s * 16807) % 2147483647; const py = y + (s % 10000) / 10000 * h; ctx.fillRect(px, py, 2 * scale, 2 * scale); } }
  ctx.restore();
}

function drawPhoto(env: RenderEnv, doc: Doc, ctx: Ctx, l: PhotoLayer, plan: ExportPlan) {
  const k = plan.scale;
  const w = Math.max(1, Math.round(l.w * k)), h = Math.max(1, Math.round(l.h * k));
  const bw = Math.round((l.border?.width ?? 0) * k);
  const img = l.src ? env.images[l.src] : null;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.translate(plan.dx + (l.x + l.w / 2) * k, plan.dy + (l.y + l.h / 2) * k);
  ctx.rotate((l.rotation * Math.PI) / 180);
  const rad = l.radius * k;
  if (l.shadow) { ctx.shadowColor = 'rgba(53,43,53,0.28)'; ctx.shadowBlur = 22 * k; ctx.shadowOffsetY = 6 * k; }
  if (!img) {
    if (env.placeholders) {
      roundRectPath(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.fillStyle = 'rgba(252,228,236,0.7)'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.setLineDash([10 * k, 8 * k]); ctx.strokeStyle = '#D96C93'; ctx.lineWidth = 3 * k; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore(); return;
  }
  if (bw > 0) { roundRectPath(ctx, -w / 2, -h / 2, w, h, rad); ctx.fillStyle = l.border.color; ctx.fill(); ctx.shadowColor = 'transparent'; }
  const iw = w - bw * 2, ih = h - bw * 2;
  if (iw < 1 || ih < 1) { ctx.restore(); return; }
  // Render the photo at its final pixel size, filter it, then composite.
  const off = env.createCanvas(iw, ih);
  const octx = off.getContext('2d', { willReadFrequently: true });
  const { sx, sy, sw, sh } = coverSourceRect(img.width, img.height, iw, ih, l.crop);
  if (l.mirror) { octx.translate(iw, 0); octx.scale(-1, 1); }
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, iw, ih);
  const state = l.filter === undefined ? doc.filter : l.filter;
  if (state) {
    const params = resolveParams(state);
    if (!isNeutral(params)) {
      try {
        const data = octx.getImageData(0, 0, iw, ih);
        applyFilterToImageData(data.data, iw, ih, params, { seed: hash(l.id) });
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.putImageData(data, 0, 0);
      } catch (e) {
        throw Object.assign(new Error('Could not read photo pixels (cross-origin image?). Load images from your device or with CORS enabled.'), { code: 'render-failed' });
      }
    }
  }
  ctx.save();
  roundRectPath(ctx, -iw / 2, -ih / 2, iw, ih, Math.max(0, rad - bw));
  ctx.clip();
  ctx.drawImage(off, -iw / 2, -ih / 2);
  ctx.restore();
  ctx.restore();
}

export function wrapText(measure: (s: string) => number, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = `${line} ${words[i]}`;
      if (measure(t) <= maxW) line = t; else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx: Ctx, l: TextLayer, plan: ExportPlan) {
  const k = plan.scale;
  const fs = l.fontSize * k;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.translate(plan.dx + (l.x + l.w / 2) * k, plan.dy + (l.y + l.h / 2) * k);
  ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.font = `${l.fontWeight} ${fs}px ${l.fontFamily}`;
  ctx.fillStyle = l.color; ctx.textBaseline = 'top';
  ctx.textAlign = l.align;
  const lines = wrapText((s) => ctx.measureText(s).width, l.text, l.w * k);
  const lh = fs * 1.25;
  const x = l.align === 'left' ? (-l.w * k) / 2 : l.align === 'right' ? (l.w * k) / 2 : 0;
  const top = -(lines.length * lh) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, top + i * lh));
  ctx.restore();
}

function drawLayer(env: RenderEnv, doc: Doc, ctx: Ctx, l: Layer, plan: ExportPlan) {
  const k = plan.scale;
  if (l.kind === 'photo') return drawPhoto(env, doc, ctx, l, plan);
  if (l.kind === 'text') return drawText(ctx, l, plan);
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.translate(plan.dx + (l.x + l.w / 2) * k, plan.dy + (l.y + l.h / 2) * k);
  ctx.rotate((l.rotation * Math.PI) / 180);
  if (l.kind === 'sticker') {
    const s = env.sticker(l.stickerId, l.color);
    if (s) ctx.drawImage(s, (-l.w * k) / 2, (-l.h * k) / 2, l.w * k, l.h * k);
  } else {
    const w = l.w * k, h = l.h * k;
    ctx.fillStyle = l.fill;
    roundRectPath(ctx, -w / 2, -h / 2, w, h, l.shape === 'tape' ? 3 * k : l.radius * k);
    ctx.fill();
    if (l.shape === 'tape') { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2 * k; ctx.setLineDash([6 * k, 6 * k]); ctx.stroke(); }
  }
  ctx.restore();
}

/** Render a document onto `ctx` following `plan`. The SAME code path is used for editor preview and export. */
export function renderDoc(env: RenderEnv, doc: Doc, ctx: Ctx, plan: ExportPlan, hooks: RenderHooks = {}) {
  ctx.clearRect(0, 0, plan.width, plan.height);
  paintBackground(ctx, doc.background, plan.dx, plan.dy, plan.dw, plan.dh, plan.scale);
  ctx.save();
  ctx.beginPath(); ctx.rect(plan.dx, plan.dy, plan.dw, plan.dh); ctx.clip();
  const total = doc.layers.length;
  for (let i = 0; i < total; i++) {
    if (hooks.isCancelled?.()) { ctx.restore(); throw Object.assign(new Error('Export cancelled'), { code: 'cancelled' }); }
    drawLayer(env, doc, ctx, doc.layers[i], plan);
    hooks.onLayer?.(i + 1, total);
  }
  ctx.restore();
}
