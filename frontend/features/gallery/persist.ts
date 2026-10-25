'use client';
import { api } from '../../lib/api.ts';
import type { Doc, Project } from '../../lib/editor/model.ts';
import { blobGet, blobPut, getBlob, localGet, localPut, registerBlob } from '../../lib/blobs.ts';
import type { Bitmap } from '../../lib/runtime.ts';
import { canvasThumb, loadBitmap } from '../../lib/runtime.ts';

export function usedImageKeys(docs: Doc[]): string[] {
  const s = new Set<string>();
  for (const d of docs) { for (const l of d.layers) if (l.kind === 'photo' && l.src) s.add(l.src); for (const x of d.spare ?? []) s.add(x.src); }
  return [...s];
}

export async function saveLocal(p: Project, previewCanvas?: HTMLCanvasElement): Promise<void> {
  const keys = usedImageKeys(p.docs);
  for (const k of keys) { const b = getBlob(k); if (b) await blobPut(p.id, k, b); }
  const prev = await localGet(p.id);
  await localPut({ id: p.id, name: p.name, type: p.type, docs: p.docs, blobKeys: keys, createdAt: prev?.createdAt ?? Date.now(), updatedAt: Date.now(), thumb: previewCanvas ? canvasThumb(previewCanvas) : prev?.thumb });
}

export async function loadLocal(id: string): Promise<{ project: Project; images: Record<string, Bitmap> } | null> {
  const lp = await localGet(id); if (!lp) return null;
  const images: Record<string, Bitmap> = {};
  for (const k of lp.blobKeys) { const b = await blobGet(id, k); if (b) { registerBlob(k, b); images[k] = await loadBitmap(b); } }
  return { project: { id: lp.id, name: lp.name, type: lp.type as Project['type'], docs: lp.docs as Doc[] }, images };
}

/* ---- cloud (explicit user action only) ---- */
interface AssetRes { id: string; url: string; width: number; height: number }

export async function saveCloud(p: Project, cloudId: string | null, assetMap: Record<string, string>, preview?: Blob): Promise<{ id: string; assetMap: Record<string, string> }> {
  const map = { ...assetMap };
  for (const k of usedImageKeys(p.docs)) {
    if (map[k]) continue;
    const blob = getBlob(k); if (!blob) continue;
    const fd = new FormData(); fd.append('file', blob, `${k}.${blob.type.split('/')[1] ?? 'jpg'}`);
    const a = await api<AssetRes>('/assets', { form: fd });
    map[k] = a.id;
  }
  let previewAssetId: string | undefined;
  if (preview) { const fd = new FormData(); fd.append('file', preview, 'preview.jpg'); previewAssetId = (await api<AssetRes>('/assets', { form: fd })).id; }
  const body = { name: p.name, projectType: p.type, document: { docs: p.docs, assets: map }, ...(previewAssetId ? { previewAssetId } : {}) };
  if (cloudId) { await api(`/projects/${cloudId}`, { method: 'PATCH', json: body }); return { id: cloudId, assetMap: map }; }
  const created = await api<{ id: string }>('/projects', { json: body });
  return { id: created.id, assetMap: map };
}

export async function loadCloud(id: string): Promise<{ project: Project; images: Record<string, Bitmap>; assetMap: Record<string, string> }> {
  const r = await api<{ id: string; name: string; projectType: Project['type']; document: { docs: Doc[]; assets: Record<string, string> } }>(`/projects/${id}`);
  const images: Record<string, Bitmap> = {};
  for (const [key, assetId] of Object.entries(r.document.assets ?? {})) {
    const meta = await api<AssetRes>(`/assets/${assetId}`); // returns a short-lived signed URL
    const res = await fetch(meta.url, { credentials: 'same-origin' });
    if (!res.ok) continue;
    const blob = await res.blob(); registerBlob(key, blob); images[key] = await loadBitmap(blob);
  }
  return { project: { id: r.id, name: r.name, type: r.projectType, docs: r.document.docs }, images, assetMap: r.document.assets ?? {} };
}
