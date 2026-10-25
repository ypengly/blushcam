'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, ImagePlus, RefreshCw, Palette } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera.ts';
import { ProjectEditor } from '../../features/editor/ProjectEditor.tsx';
import { BOOTH_LAYOUTS, BOOTH_THEMES, buildBoothDoc, restyleBoothDoc } from '../../features/photo-booth/layouts.ts';
import type { BoothLayoutId } from '../../features/photo-booth/layouts.ts';
import { DocPreview } from '../../components/DocPreview.tsx';
import { Slider } from '../../features/editor/Panels.tsx';
import { loadBitmap } from '../../lib/runtime.ts';

type Phase = 'setup' | 'capture' | 'select' | 'edit';

function Booth() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>('setup');
  const [layout, setLayout] = useState<BoothLayoutId>('four');
  const [theme, setTheme] = useState(params.get('theme') ?? 'coquette-pink');
  const [countdown, setCountdown] = useState<3 | 5 | 10>(3);
  const [extra, setExtra] = useState(0);
  const [caption, setCaption] = useState(''); const [date, setDate] = useState(true);
  const [shots, setShots] = useState<Blob[]>([]); const [urls, setUrls] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [counting, setCounting] = useState<number | null>(null); const [flash, setFlash] = useState(false); const [err, setErr] = useState<string | null>(null);
  const cam = useCamera(); const run = useRef(0); const upload = useRef<HTMLInputElement>(null);
  const need = BOOTH_LAYOUTS[layout].count; const total = need + extra;
  const dateText = date ? new Date().toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;

  useEffect(() => { const u = shots.map((b) => URL.createObjectURL(b)); setUrls(u); return () => u.forEach(URL.revokeObjectURL); }, [shots]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  /** Auto-capture sequence. `only` retakes one index. */
  const sequence = async (only?: number) => {
    const id = ++run.current; setErr(null);
    for (let i = only ?? 0; i < (only !== undefined ? only + 1 : total); i++) {
      for (let c = countdown; c > 0; c--) { if (run.current !== id) return; setCounting(c); await sleep(1000); }
      if (run.current !== id) return; setCounting(null);
      try { const b = await cam.grab(); setFlash(true); setTimeout(() => setFlash(false), 300); setShots((s) => { const n = [...s]; n[i] = b; return n; }); }
      catch (e) { setErr((e as Error).message); return; }
      await sleep(700);
    }
    if (run.current === id) { setCounting(null); setPhase('select'); setPicked(Array.from({ length: need }, (_, k) => k)); }
  };
  const startSession = async () => { setShots([]); setPhase('capture'); await cam.start(); };
  useEffect(() => { if (phase === 'capture' && cam.state.status === 'ready' && shots.length === 0 && counting === null) void sequence(); /* eslint-disable-next-line */ }, [phase, cam.state.status]);
  useEffect(() => () => { run.current++; }, []);
  useEffect(() => { if (phase === 'edit' || phase === 'select') cam.stop(); /* eslint-disable-next-line */ }, [phase]);

  const loadFiles = async (files: File[]) => {
    try { const list = files.slice(0, total); for (const f of list) (await loadBitmap(f)).close(); setShots(list); setPicked(Array.from({ length: Math.min(need, list.length) }, (_, k) => k)); setPhase('select'); }
    catch (e) { setErr((e as Error).message); }
  };
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < need ? [...p, i] : p));
  const chosen = picked.map((i) => shots[i]).filter(Boolean);

  if (phase === 'edit') {
    return <ProjectEditor key="booth-edit" type="booth" defaultName="Photo strip" seedPhotos={chosen} initial={() => buildBoothDoc(layout, theme, { date: dateText, caption: caption || undefined })}
      tools={({ editor }) => [{ id: 'template', label: 'Frames', icon: <Palette size={18} />, panel: <FramePanel editor={editor} /> }]} />;
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-3xl">Photo booth</h1>
      <input ref={upload} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files && loadFiles([...e.target.files])} />
      {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {phase === 'setup' && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-5">
            <fieldset><legend className="label">Layout</legend><div className="flex flex-wrap gap-2">{Object.values(BOOTH_LAYOUTS).map((l) => <button key={l.id} className="chip" aria-pressed={layout === l.id} onClick={() => setLayout(l.id)}>{l.label}</button>)}</div></fieldset>
            <fieldset><legend className="label">Frame theme</legend><div className="flex flex-wrap gap-2">{BOOTH_THEMES.map((t) => <button key={t.id} className="chip" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>{t.name}</button>)}</div></fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset><legend className="label">Countdown</legend><div className="flex gap-2">{([3, 5, 10] as const).map((c) => <button key={c} className="chip" aria-pressed={countdown === c} onClick={() => setCountdown(c)}>{c}s</button>)}</div></fieldset>
              <fieldset><legend className="label">Extra shots to choose from</legend><div className="flex gap-2">{[0, 2, 4].map((c) => <button key={c} className="chip" aria-pressed={extra === c} onClick={() => setExtra(c)}>{c ? `+${c}` : 'None'}</button>)}</div></fieldset>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="cap">Caption (optional)</label><input id="cap" className="input" maxLength={60} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={date} onChange={(e) => setDate(e.target.checked)} /> Print today’s date</label></div>
            <div className="flex flex-wrap gap-3"><button className="btn-primary !py-3" onClick={startSession}><Camera size={18} /> Start {total}-shot session</button><button className="btn-soft !py-3" onClick={() => upload.current?.click()}><ImagePlus size={18} /> Use my photos instead</button></div>
          </div>
          <div className="card flex justify-center"><DocPreview doc={buildBoothDoc(layout, theme, { caption: caption || undefined, date: dateText })} className="max-h-[28rem] w-auto" label="Strip preview" /></div>
        </div>
      )}
      {phase === 'capture' && (
        <div className="mt-5">
          <div className="relative mx-auto max-w-2xl overflow-hidden rounded-xl3 bg-ink/90 shadow-soft" style={{ aspectRatio: '4 / 3' }}>
            <video ref={cam.videoRef} playsInline muted aria-label="Live camera preview" className="h-full w-full -scale-x-100 object-cover" />
            {counting !== null && <div className="pop absolute inset-0 flex items-center justify-center text-9xl font-bold text-white drop-shadow-lg" aria-live="assertive">{counting}</div>}
            {flash && <div className="flash absolute inset-0 bg-white" aria-hidden />}
            {cam.state.status === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-soft p-6 text-center"><p role="alert" className="text-sm">{cam.state.error?.message}</p><div className="flex gap-2"><button className="btn-primary" onClick={() => void cam.start()}>Try again</button><button className="btn-soft" onClick={() => { run.current++; setPhase('setup'); }}>Back</button></div></div>}
          </div>
          <p className="mt-3 text-center text-sm text-muted" role="status">Shot {Math.min(total, shots.filter(Boolean).length + 1)} of {total}</p>
          <div className="mt-3 flex justify-center"><button className="btn-ghost" onClick={() => { run.current++; cam.stop(); setCounting(null); setShots([]); setPhase('setup'); }}>Cancel session</button></div>
        </div>
      )}
      {phase === 'select' && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-muted">{extra ? `Choose ${need} photos for your strip (in the order you tap).` : 'Happy with these? Retake any shot, or the whole session.'}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {urls.map((u, i) => <li key={i} className="relative">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt={`Shot ${i + 1}`} className={`aspect-[4/3] w-full rounded-xl object-cover ring-4 ${picked.includes(i) ? 'ring-rose' : 'ring-transparent'}`} />
              <button className="absolute inset-0 rounded-xl" aria-pressed={picked.includes(i)} aria-label={`${picked.includes(i) ? 'Deselect' : 'Select'} shot ${i + 1}`} onClick={() => toggle(i)} />
              {picked.includes(i) && <span className="absolute left-2 top-2 rounded-full bg-rose px-2 text-xs font-bold text-white">{picked.indexOf(i) + 1}</span>}
              <button className="btn-soft absolute bottom-2 right-2 !p-1.5" aria-label={`Retake shot ${i + 1}`} onClick={async () => { setPhase('capture'); await cam.start(); await sequence(i); }}><RefreshCw size={14} /></button></li>)}
          </ul>
          <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={picked.length !== need} onClick={() => setPhase('edit')}>Make my strip ({picked.length}/{need})</button><button className="btn-soft" onClick={() => { setShots([]); setPhase('capture'); void cam.start(); }}>Retake all</button><button className="btn-ghost" onClick={() => setPhase('setup')}>Back to setup</button></div>
        </div>
      )}
    </main>
  );
}

function FramePanel({ editor }: { editor: import('../../hooks/useEditor.ts').EditorApi }) {
  const theme = editor.doc.meta?.theme ?? 'coquette-pink';
  const cap = editor.doc.layers.find((l) => l.kind === 'text');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">{BOOTH_THEMES.map((t) => <button key={t.id} className="chip justify-center py-2" aria-pressed={theme === t.id} onClick={() => editor.update((d) => restyleBoothDoc(d, t.id))}>{t.name}</button>)}</div>
      <div><label className="label" htmlFor="fc">Frame colour (overrides theme)</label><input id="fc" type="color" className="h-8 w-14 rounded" onChange={(e) => editor.update((d) => ({ ...d, background: { kind: 'solid', color: e.target.value } }), 'frame')} /></div>
      {cap && cap.kind === 'text' && <div><label className="label" htmlFor="cc">Caption</label><input id="cc" className="input" maxLength={60} value={cap.text} onChange={(e) => editor.update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === cap.id && l.kind === 'text' ? { ...l, text: e.target.value } : l)) }), 'caption')} /></div>}
      <Slider label="Photo corner radius" value={editor.doc.layers.find((l) => l.kind === 'photo')?.kind === 'photo' ? (editor.doc.layers.find((l) => l.kind === 'photo') as { radius: number }).radius : 0} min={0} max={60} onChange={(v) => editor.update((d) => ({ ...d, layers: d.layers.map((l) => (l.kind === 'photo' ? { ...l, radius: v } : l)) }), 'rad')} />
    </div>
  );
}
export default function Page() { return <Suspense><Booth /></Suspense>; }
