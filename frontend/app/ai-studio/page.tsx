'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wand2, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../../lib/api.ts';
import { useUser } from '../../hooks/useUser.ts';
import { downloadBlob, ACCEPTED_IMAGE_TYPES, MAX_INPUT_BYTES } from '../../lib/runtime.ts';

interface Cap { operation: string; label: string; available: boolean; kind: 'local-classical' | 'external-provider' | 'unavailable'; reason?: string; external: boolean }

export default function AiStudio() {
  const { user, loading } = useUser();
  const [caps, setCaps] = useState<Cap[] | null>(null); const [capErr, setCapErr] = useState<string | null>(null);
  const [op, setOp] = useState(''); const [file, setFile] = useState<File | null>(null); const [consent, setConsent] = useState(false);
  const [bg, setBg] = useState('#FCE4EC'); const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null); const [src, setSrc] = useState<string | null>(null);
  const ctl = useState(() => ({ c: null as AbortController | null }))[0];

  useEffect(() => { api<{ operations: Cap[] }>('/ai/capabilities').then((r) => { setCaps(r.operations); setOp(r.operations.find((o) => o.available)?.operation ?? ''); }).catch((e) => setCapErr(e instanceof ApiError && e.status === 0 ? 'The server isn’t reachable, so AI features are unavailable right now. Camera, filters, collage and scrapbook still work offline in your browser.' : 'AI status could not be loaded.')); }, []);
  useEffect(() => { if (!file) { setSrc(null); return; } const u = URL.createObjectURL(file); setSrc(u); return () => URL.revokeObjectURL(u); }, [file]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  const cur = caps?.find((c) => c.operation === op);

  const run = async () => {
    if (!file || !cur) return; setErr(null); setBusy(true); setResult(null); ctl.c = new AbortController();
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('operation', op); fd.append('consent', String(consent)); fd.append('background', bg); fd.append('scale', String(scale));
      const res = await fetch('/api/v1/ai/process', { method: 'POST', body: fd, credentials: 'same-origin', signal: ctl.c.signal, headers: { 'X-CSRF-Token': (await import('../../lib/api.ts')).getCsrf() } });
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error?.message ?? `Processing failed (${res.status}).`); }
      const blob = await res.blob(); setResult({ blob, url: URL.createObjectURL(blob) });
    } catch (e) { setErr((e as Error).name === 'AbortError' ? 'Cancelled.' : (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="flex items-center gap-2 font-display text-3xl"><Wand2 className="text-rose" /> AI studio</h1>
      <p className="mt-1 text-muted">Opt-in enhancement. Each tool states whether it runs on our server or needs an external provider — and says plainly when it isn’t available.</p>
      {capErr && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{capErr}</p>}
      {caps && <ul className="mt-5 grid gap-2 sm:grid-cols-2">{caps.map((c) => (
        <li key={c.operation}><button disabled={!c.available} aria-pressed={op === c.operation} onClick={() => setOp(c.operation)} className={`card w-full text-left ${op === c.operation ? 'ring-2 ring-rose' : ''} ${!c.available ? 'opacity-60' : ''}`}>
          <span className="font-bold">{c.label}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.available ? 'bg-mint' : 'bg-soft'}`}>{c.available ? (c.external ? 'external provider' : 'on our server') : 'not available'}</span>
          {c.reason && <span className="mt-1 block text-xs text-muted">{c.reason}</span>}</button></li>))}</ul>}
      {!loading && !user && <p className="mt-5 card">AI processing uploads your photo to the server, so it needs an account. <Link className="font-semibold text-rose" href="/login?next=/ai-studio">Sign in</Link> or <Link className="font-semibold text-rose" href="/register">create one</Link>.</p>}
      {user && cur && (
        <section className="mt-6 card space-y-4" aria-label="Run AI tool">
          <div><label className="label" htmlFor="aif">Photo (PNG, JPEG or WebP, up to {MAX_INPUT_BYTES / 1e6 | 0} MB)</label><input id="aif" type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} /></div>
          {op === 'upscale' && <div><span className="label">Upscale factor (classical resampling, not generative)</span><div className="flex gap-2">{[2, 3, 4].map((s) => <button key={s} className="chip" aria-pressed={scale === s} onClick={() => setScale(s)}>{s}×</button>)}</div></div>}
          {op === 'replace-background' && <div><label className="label" htmlFor="bgc">Replacement colour</label><input id="bgc" type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></div>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{cur.external ? <><ShieldAlert size={14} className="mr-1 inline text-rose" /><strong>I agree to send this photo to a third-party AI provider</strong> configured by this site for this one request. See the <Link className="text-rose underline" href="/privacy">privacy policy</Link>.</> : <>I agree to upload this photo to BlushCam’s server for this one request. It is processed in memory and not kept.</>}</span></label>
          <div className="flex gap-2"><button className="btn-primary" disabled={!file || !consent || busy} onClick={run}>{busy ? 'Processing…' : `Run ${cur.label}`}</button>{busy && <button className="btn-ghost" onClick={() => ctl.c?.abort()}>Cancel</button>}</div>
          {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          {src && <div className="grid gap-3 sm:grid-cols-2"><figure><figcaption className="label">Original</figcaption>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="Original" className="w-full rounded-xl" /></figure>
            {result && <figure><figcaption className="label">Result</figcaption>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.url} alt="Result" className="w-full rounded-xl" /><button className="btn-soft mt-2" onClick={() => downloadBlob(result.blob, `blushcam-${op}.${result.blob.type.split('/')[1] ?? 'png'}`)}>Download</button></figure>}</div>}
        </section>)}
    </main>
  );
}
