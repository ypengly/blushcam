import type { Doc } from '../editor/model.ts';
import { renderDoc } from '../editor/render.ts';
import type { RenderEnv } from '../editor/render.ts';
import { ExportError, mimeFor, planExport } from './dimensions.ts';
import type { ExportOptions } from './dimensions.ts';

export interface ExportEnv extends RenderEnv {
  toBlob(canvas: any, mime: string, quality: number): Promise<Blob | null>;
}
export interface ExportHooks { onProgress?: (fraction: number) => void; isCancelled?: () => boolean }

/** Render the doc at the requested size and encode it. Never downgrades the size or returns the unedited photo. */
export async function exportDoc(env: ExportEnv, doc: Doc, options: ExportOptions, hooks: ExportHooks = {}): Promise<Blob> {
  const plan = planExport(doc, options);
  const canvas = env.createCanvas(plan.width, plan.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('render-failed', 'Could not create a drawing surface (the image may be too large for this device).');
  hooks.onProgress?.(0.02);
  try {
    renderDoc({ ...env, placeholders: false }, doc, ctx, plan, {
      isCancelled: hooks.isCancelled,
      onLayer: (d, t) => hooks.onProgress?.(0.02 + 0.88 * (d / Math.max(1, t))),
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'cancelled') throw new ExportError('cancelled', 'Export cancelled.');
    throw new ExportError('render-failed', (e as Error).message || 'Rendering failed.');
  }
  // Yield so progress UI can paint before the (blocking) encode.
  await new Promise((r) => setTimeout(r, 0));
  const mime = mimeFor(plan.format);
  const blob = await env.toBlob(canvas, mime, plan.quality);
  if (!blob || blob.size === 0) throw new ExportError('encode-failed', 'The browser could not encode the image. Try a smaller size or another format.');
  if (blob.type && blob.type !== mime) {
    // Browsers silently fall back to PNG for unsupported types (e.g. WebP on old Safari). Don't pass that off as success.
    throw new ExportError('unsupported-format', `This browser can’t export ${plan.format.toUpperCase()}. Choose PNG or JPEG.`);
  }
  hooks.onProgress?.(1);
  return blob;
}
