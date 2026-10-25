'use client';
import { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { ExportError, SOCIAL_RATIOS, exportFileName, planExport, sizeForRatio } from '../../lib/export/dimensions.ts';
import type { ExportFormat } from '../../lib/export/dimensions.ts';
import { exportDoc } from '../../lib/export/exportDoc.ts';
import { downloadBlob, makeExportEnv, preloadStickers } from '../../lib/runtime.ts';
import type { EditorApi } from '../../hooks/useEditor.ts';
import { Slider } from './Panels.tsx';

export function ExportDialog({ editor, name, onClose, allDocs }: { editor: EditorApi; name: string; onClose: () => void; allDocs?: import('../../lib/editor/model.ts').Doc[] }) {
  const { doc } = editor;
  const [format, setFormat] = useState<ExportFormat>('png');
  const [preset, setPreset] = useState<'standard' | 'high'>('high');
  const [ratio, setRatio] = useState<string>('doc');
  const [custom, setCustom] = useState<{ w: string; h: string }>({ w: '', h: '' });
  const [quality, setQuality] = useState(90);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cancel = useRef(false);

  const size = (() => {
    if (custom.w || custom.h) return { width: Number(custom.w) || undefined, height: Number(custom.h) || undefined };
    const r = SOCIAL_RATIOS.find((x) => x.id === ratio)?.ratio ?? null;
    if (r === null) return {};
    return sizeForRatio(doc, r, preset === 'high' ? Math.max(doc.width, doc.height) * 2 : Math.max(doc.width, doc.height));
  })();

  let preview = '';
  try { const p = planExport(doc, { format, width: size.width, height: size.height, quality_preset: preset }); preview = `${p.width} × ${p.height}px`; } catch (e) { preview = e instanceof ExportError ? e.message : 'Invalid size'; }

  const run = async () => {
    setError(null); setDone(null); cancel.current = false; setProgress(0);
    try {
      const docs = allDocs && allDocs.length > 1 ? allDocs : [doc];
      for (let i = 0; i < docs.length; i++) await preloadStickers(docs[i]);
      const env = makeExportEnv(editor.images);
      const blob = await exportDoc(env, doc, { format, width: size.width, height: size.height, quality: quality / 100, quality_preset: preset }, { onProgress: setProgress, isCancelled: () => cancel.current });
      downloadBlob(blob, exportFileName(name, format));
      setDone(`Saved ${(blob.size / 1024).toFixed(0)} KB ${format.toUpperCase()}`);
    } catch (e) {
      setError(e instanceof ExportError ? e.message : 'Export failed. Please try again.');
    } finally { setProgress(null); }
  };

  const pdf = async () => {
    setError(null); setProgress(0);
    try {
      const { jsPDF } = await import('jspdf');
      const docs = allDocs && allDocs.length ? allDocs : [doc];
      const env = makeExportEnv(editor.images);
      let pdfDoc: InstanceType<typeof jsPDF> | null = null;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i]; await preloadStickers(d);
        const blob = await exportDoc(env, d, { format: 'jpeg', quality: 0.92, quality_preset: 'standard' });
        const url = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });
        const orient = d.width >= d.height ? 'l' : 'p';
        if (!pdfDoc) pdfDoc = new jsPDF({ orientation: orient, unit: 'px', format: [d.width, d.height], hotfixes: ['px_scaling'] });
        else pdfDoc.addPage([d.width, d.height], orient);
        pdfDoc.addImage(url, 'JPEG', 0, 0, d.width, d.height);
        setProgress((i + 1) / docs.length);
      }
      pdfDoc!.save(exportFileName(name, 'png').replace(/\.png$/, '.pdf'));
      setDone(`Saved PDF (${docs.length} page${docs.length > 1 ? 's' : ''})`);
    } catch { setError('PDF export failed. Try exporting pages as images instead.'); }
    finally { setProgress(null); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="exp-title" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      <div className="card pop max-h-[92dvh] w-full overflow-auto sm:max-w-md">
        <div className="mb-3 flex items-center justify-between"><h2 id="exp-title" className="font-display text-xl">Export</h2><button aria-label="Close" className="btn-ghost !p-2" onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-4">
          <div><span className="label">Format</span><div className="flex gap-1.5">{(['png', 'jpeg', 'webp'] as const).map((f) => <button key={f} className="chip" aria-pressed={format === f} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>)}</div></div>
          <div><span className="label">Quality</span><div className="flex gap-1.5">{(['standard', 'high'] as const).map((q) => <button key={q} className="chip" aria-pressed={preset === q} onClick={() => setPreset(q)}>{q === 'high' ? 'High (2×)' : 'Standard (1×)'}</button>)}</div></div>
          {format !== 'png' && <Slider label="Compression quality" value={quality} min={40} max={100} onChange={setQuality} />}
          <div><span className="label">Aspect ratio (fits inside, never stretches)</span><div className="flex flex-wrap gap-1.5">{SOCIAL_RATIOS.map((r) => <button key={r.id} className="chip" aria-pressed={ratio === r.id && !custom.w && !custom.h} onClick={() => { setRatio(r.id); setCustom({ w: '', h: '' }); }}>{r.label}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label" htmlFor="ew">Custom width (px)</label><input id="ew" className="input" inputMode="numeric" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label className="label" htmlFor="eh">Custom height (px)</label><input id="eh" className="input" inputMode="numeric" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value.replace(/\D/g, '') })} /></div></div>
          <p className="text-sm text-muted" aria-live="polite">Output: <strong className="text-ink">{preview}</strong></p>
          {progress !== null && <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 overflow-hidden rounded-full bg-blush/50"><div className="h-full bg-rose transition-all" style={{ width: `${progress * 100}%` }} /></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {done && <p role="status" className="rounded-xl bg-mint p-3 text-sm">{done}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={progress !== null} onClick={run}><Download size={16} /> Download {format.toUpperCase()}</button>
            {doc.type === 'scrapbook' && <button className="btn-soft" disabled={progress !== null} onClick={pdf}>PDF{allDocs && allDocs.length > 1 ? ` (${allDocs.length} pages)` : ''}</button>}
            {progress !== null && <button className="btn-ghost" onClick={() => { cancel.current = true; }}>Cancel</button>}
          </div>
          <p className="text-xs text-muted">Everything is rendered in your browser. Nothing is uploaded.</p>
        </div>
      </div>
    </div>
  );
}
