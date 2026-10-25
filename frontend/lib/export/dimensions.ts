import type { Doc } from '../editor/model.ts';

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export interface ExportOptions {
  format: ExportFormat;
  /** 0..1; ignored for png */
  quality?: number;
  /** Output size. If only width OR height is given, the other follows the aspect ratio. */
  width?: number;
  height?: number;
  /** When both width+height are given and ratios differ, the design is fitted inside (never stretched). */
  fit?: 'contain';
  quality_preset?: 'standard' | 'high';
}

export const MAX_EXPORT_PIXELS = 36_000_000; // documented limit: ~6000x6000
export const MAX_EXPORT_SIDE = 8192;

export class ExportError extends Error {
  code: 'too-large' | 'invalid-size' | 'transparent-unsupported' | 'unsupported-format' | 'render-failed' | 'encode-failed' | 'cancelled';
  constructor(code: ExportError['code'], message: string) { super(message); this.name = 'ExportError'; this.code = code; }
}

export const SOCIAL_RATIOS = [
  { id: 'doc', label: 'Original', ratio: null }, { id: '1:1', label: 'Square 1:1', ratio: 1 }, { id: '4:5', label: 'Instagram 4:5', ratio: 4 / 5 },
  { id: '9:16', label: 'Story 9:16', ratio: 9 / 16 }, { id: '16:9', label: 'Wide 16:9', ratio: 16 / 9 },
] as const;

export interface ExportPlan { width: number; height: number; /** where the doc is drawn inside the output canvas */ dx: number; dy: number; dw: number; dh: number; scale: number; format: ExportFormat; quality: number }

export function mimeFor(format: ExportFormat): string { return format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp'; }
export function extFor(format: ExportFormat): string { return format === 'jpeg' ? 'jpg' : format; }

export function planExport(doc: Doc, o: ExportOptions): ExportPlan {
  if (!['png', 'jpeg', 'webp'].includes(o.format)) throw new ExportError('unsupported-format', `Unsupported format: ${o.format}`);
  if (doc.background.kind === 'transparent' && o.format === 'jpeg') {
    throw new ExportError('transparent-unsupported', 'JPEG cannot store transparency. Choose PNG or WebP, or pick a solid background.');
  }
  const ratio = doc.width / doc.height;
  let width: number, height: number;
  if (o.width && o.height) { width = Math.round(o.width); height = Math.round(o.height); }
  else if (o.width) { width = Math.round(o.width); height = Math.round(o.width / ratio); }
  else if (o.height) { height = Math.round(o.height); width = Math.round(o.height * ratio); }
  else { const k = o.quality_preset === 'high' ? 2 : 1; width = doc.width * k; height = doc.height * k; }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new ExportError('invalid-size', 'Output size must be positive.');
  if (width > MAX_EXPORT_SIDE || height > MAX_EXPORT_SIDE || width * height > MAX_EXPORT_PIXELS) {
    throw new ExportError('too-large', `Requested ${width}×${height}px exceeds the limit of ${MAX_EXPORT_SIDE}px per side / ${(MAX_EXPORT_PIXELS / 1e6).toFixed(0)} megapixels. Choose a smaller size — the export was not downscaled automatically.`);
  }
  const scale = Math.min(width / doc.width, height / doc.height);
  const dw = Math.round(doc.width * scale), dh = Math.round(doc.height * scale);
  const quality = o.format === 'png' ? 1 : o.quality ?? (o.quality_preset === 'high' ? 0.95 : 0.85);
  return { width, height, dx: Math.round((width - dw) / 2), dy: Math.round((height - dh) / 2), dw, dh, scale, format: o.format, quality };
}

/** Output size for a social aspect, keeping the design's width (fit inside, never stretch). */
export function sizeForRatio(doc: Doc, ratio: number | null, longSide = Math.max(doc.width, doc.height)): { width: number; height: number } {
  if (ratio === null) return { width: doc.width, height: doc.height };
  return ratio >= 1 ? { width: longSide, height: Math.round(longSide / ratio) } : { width: Math.round(longSide * ratio), height: longSide };
}

export function exportFileName(name: string, format: ExportFormat, now = new Date()): string {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blushcam';
  return `${safe}-${now.toISOString().slice(0, 10)}.${extFor(format)}`;
}
