'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, ImagePlus } from 'lucide-react';
import { ProjectEditor } from '../../features/editor/ProjectEditor.tsx';
import { handoffTake } from '../../lib/blobs.ts';
import { loadBitmap, ImageLoadError } from '../../lib/runtime.ts';
import { newDoc, photoLayer } from '../../lib/editor/model.ts';
import type { Doc } from '../../lib/editor/model.ts';
import { PRESET_BY_ID } from '../../features/filters/presets.ts';

function Studio() {
  const params = useSearchParams(); const router = useRouter();
  const [seed, setSeed] = useState<{ doc: Doc; blobs: Blob[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const begin = async (blob: Blob) => {
    try {
      const bmp = await loadBitmap(blob); const k = 2048 / Math.max(bmp.width, bmp.height, 2048);
      const w = Math.round(bmp.width * Math.min(1, k)), h = Math.round(bmp.height * Math.min(1, k));
      let doc = newDoc('photo', w, h); doc.layers.push(photoLayer({ x: 0, y: 0, w, h, locked: true }));
      const fid = params.get('filter'); if (fid && PRESET_BY_ID[fid]) doc = { ...doc, filter: { ...doc.filter, presetId: fid } };
      bmp.close(); setSeed({ doc, blobs: [blob] });
    } catch (e) { setErr(e instanceof ImageLoadError ? e.message : 'Could not open that image.'); }
  };
  useEffect(() => { if (params.get('from') === 'camera') handoffTake().then((b) => b[0] ? begin(b[0]) : setErr('No photo was handed over from the camera. Take one again or upload.')); /* eslint-disable-next-line */ }, []);

  if (seed) return <ProjectEditor key="studio" type="photo" defaultName="My photo" initial={() => seed.doc} seedPhotos={seed.blobs} />;
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <h1 className="font-display text-4xl">Photo studio</h1>
      <p className="text-muted">Start with a photo. It stays on your device.</p>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && begin(e.target.files[0])} />
      <div className="flex flex-wrap justify-center gap-3">
        <button className="btn-primary !py-3" onClick={() => file.current?.click()}><ImagePlus size={18} /> Upload a photo</button>
        <button className="btn-soft !py-3" onClick={() => router.push('/camera')}><Camera size={18} /> Use camera</button>
      </div>
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void begin(f); }} className="w-full rounded-xl3 border-2 border-dashed border-blush p-10 text-sm text-muted">…or drop a PNG, JPEG or WebP here</div>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
    </main>
  );
}
export default function Page() { return <Suspense><Studio /></Suspense>; }
