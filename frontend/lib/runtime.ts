'use client';
import type { Doc } from './editor/model.ts';
import type { ExportEnv } from './export/exportDoc.ts';
import { stickerDataUrl } from '../features/stickers/catalog.ts';

export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // documented client limit
export const MAX_INPUT_PIXELS = 48_000_000;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageLoadError extends Error {}

export type Bitmap = ImageBitmap | HTMLCanvasElement;

/** Decode a user file/blob, validating real decoding (not just the extension) and limits. Stays local to the browser. */
export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  if (!ACCEPTED_IMAGE_TYPES.includes(blob.type)) throw new ImageLoadError(`“${blob.type || 'unknown'}” isn’t supported. Use PNG, JPEG or WebP.`);
  if (blob.size > MAX_INPUT_BYTES) throw new ImageLoadError(`That image is ${(blob.size / 1e6).toFixed(1)} MB. The limit is ${MAX_INPUT_BYTES / 1e6} MB.`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { throw new ImageLoadError('That file couldn’t be read as an image.'); }
  if (bmp.width * bmp.height > MAX_INPUT_PIXELS) { bmp.close(); throw new ImageLoadError('That image has too many pixels for the browser editor. Please resize it first.'); }
  return bmp;
}

const stickerCache = new Map<string, HTMLCanvasElement>();
/** Rasterise a vector sticker once per (id,colour) at 512px so scaling up for export stays crisp. */
export async function rasterSticker(id: string, color?: string): Promise<HTMLCanvasElement | null> {
  const key = `${id}|${color ?? ''}`;
  const hit = stickerCache.get(key);
  if (hit) return hit;
  const url = stickerDataUrl(id, color);
  if (!url) return null;
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('sticker failed to load')); img.src = url; });
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  c.getContext('2d')!.drawImage(img, 0, 0, 512, 512);
  stickerCache.set(key, c);
  return c;
}
export async function preloadStickers(doc: Doc) {
  const jobs: Promise<unknown>[] = [];
  for (const l of doc.layers) if (l.kind === 'sticker') jobs.push(rasterSticker(l.stickerId, l.color));
  await Promise.all(jobs);
}

export function makeExportEnv(images: Record<string, { width: number; height: number }>): ExportEnv {
  return {
    images,
    createCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c as never; },
    sticker: (id, color) => stickerCache.get(`${id}|${color ?? ''}`) ?? null,
    toBlob: (canvas, mime, q) => new Promise((res) => (canvas as HTMLCanvasElement).toBlob(res, mime, q)),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Small JPEG data URL for gallery thumbnails. */
export function canvasThumb(src: HTMLCanvasElement, maxSide = 320): string {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
