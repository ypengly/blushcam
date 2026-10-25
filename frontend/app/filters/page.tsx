'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FILTER_CATEGORIES, FILTER_PRESETS, DEFAULT_FILTER_STATE, resolveParams } from '../../features/filters/presets.ts';
import { applyFilterToImageData } from '../../features/filters/engine.ts';
import type { FilterCategory } from '../../features/filters/types.ts';
import { loadBitmap } from '../../lib/runtime.ts';
import { SiteFooter } from '../../components/SiteFooter.tsx';

function sample(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f8d5b8'); g.addColorStop(0.5, '#a9c4e6'); g.addColorStop(1, '#6f8f72'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#f3c6a5'; x.beginPath(); x.arc(w / 2, h * 0.42, h * 0.2, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#c96b8e'; x.beginPath(); x.ellipse(w / 2, h * 1.02, w * 0.32, h * 0.3, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff6'; x.beginPath(); x.arc(w * 0.2, h * 0.2, h * 0.07, 0, 7); x.fill(); return c;
}

function Thumb({ src, id, strength }: { src: HTMLCanvasElement | ImageBitmap; id: string; strength: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const W = 180, H = 220; c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true })!;
    const k = Math.max(W / src.width, H / src.height); x.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);
    const d = x.getImageData(0, 0, W, H); applyFilterToImageData(d.data, W, H, resolveParams({ ...DEFAULT_FILTER_STATE, presetId: id, strength })); x.putImageData(d, 0, 0);
  }, [src, id, strength]);
  return <canvas ref={ref} className="w-full rounded-xl" aria-label={`${id} preview`} />;
}

export default function FiltersPage() {
  const [cat, setCat] = useState<FilterCategory>('natural'); const [strength, setStrength] = useState(100);
  const [src, setSrc] = useState<HTMLCanvasElement | ImageBitmap | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => setSrc(sample(360, 440)), []);
  const list = useMemo(() => FILTER_PRESETS.filter((p) => p.category === cat), [cat]);
  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-3xl">Filter gallery</h1>
        <p className="mt-1 text-muted">Previews are rendered by the same pixel engine used for export. Try your own photo:</p>
        <div className="mt-3 flex flex-wrap items-center gap-3"><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Preview on your photo" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setErr(null); setSrc(await loadBitmap(f)); } catch (x) { setErr((x as Error).message); } }} />
          <div className="w-56"><label className="label" htmlFor="gs">Strength {strength}</label><input id="gs" type="range" className="range" min={0} max={100} value={strength} onChange={(e) => setStrength(+e.target.value)} /></div></div>
        {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-2" role="tablist">{FILTER_CATEGORIES.map((c) => <button key={c.id} role="tab" aria-selected={cat === c.id} className="chip" onClick={() => setCat(c.id)}>{c.label}</button>)}</div>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{src && list.map((p) => <li key={p.id} className="card !p-2"><Thumb src={src} id={p.id} strength={strength} /><p className="mt-2 text-sm font-bold">{p.name}</p><p className="text-xs text-muted">{p.effects.join(' · ')}</p><Link className="mt-2 inline-block text-xs font-semibold text-rose" href={`/camera`}>Use with camera →</Link></li>)}</ul>
      </main>
      <SiteFooter />
    </>
  );
}
