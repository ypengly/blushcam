'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookHeart, FileText, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { ProjectEditor } from '../../features/editor/ProjectEditor.tsx';
import type { ToolCtx } from '../../features/editor/ProjectEditor.tsx';
import { PAPER_STYLES, SCRAPBOOK_TEMPLATES, addPage, buildScrapbookPage, deletePage, reorderPage } from '../../features/scrapbook/templates.ts';
import { photoLayer, textLayer, shapeLayer, addLayer } from '../../lib/editor/model.ts';

function TemplatesPanel({ ctx }: { ctx: ToolCtx }) {
  const { editor } = ctx;
  return (
    <div className="space-y-4">
      <div><span className="label">Page template</span><div className="grid gap-1.5">{SCRAPBOOK_TEMPLATES.map((t) => <button key={t.id} className="chip justify-start py-2" onClick={() => { if (editor.doc.layers.some((l) => l.kind === 'photo' && l.src) && !window.confirm('Replace this page with the template? Photos on it will be removed (you can undo).')) return; editor.update(() => buildScrapbookPage(t.id)); }}>{t.name}</button>)}</div></div>
      <div><span className="label">Paper</span><div className="flex flex-wrap gap-1.5">{Object.entries(PAPER_STYLES).map(([k, bg]) => <button key={k} className="chip" onClick={() => editor.update((d) => ({ ...d, background: bg }))}>{k}</button>)}</div></div>
      <div><span className="label">Add</span><div className="flex flex-wrap gap-1.5">
        <button className="chip" onClick={() => editor.update((d) => addLayer(d, photoLayer({ x: 300, y: 500, w: 420, h: 420, rotation: -3, border: { width: 22, color: '#FFFFFF' }, shadow: true })))}>Polaroid</button>
        <button className="chip" onClick={() => editor.update((d) => addLayer(d, shapeLayer({ shape: 'tape', x: 400, y: 480, w: 170, h: 46, rotation: -8, fill: '#F8BBD0', opacity: 0.8 })))}>Tape</button>
        <button className="chip" onClick={() => editor.update((d) => addLayer(d, textLayer({ text: new Date().toLocaleDateString(), x: 60, y: 1300, w: 400, fontSize: 44, fontFamily: '"Caveat", cursive', align: 'left' })))}>Date</button>
        <button className="chip" onClick={() => editor.update((d) => addLayer(d, textLayer({ text: 'short caption', x: 200, y: 950, w: 680, fontSize: 56, fontFamily: '"Caveat", cursive' })))}>Caption</button></div></div>
    </div>
  );
}

function PagesPanel({ ctx }: { ctx: ToolCtx }) {
  const { project, pageIndex } = ctx;
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">{project.docs.map((d, i) => <li key={i} className="flex items-center gap-1"><button className="chip flex-1 justify-start py-2" aria-pressed={i === pageIndex} onClick={() => ctx.setPageIndex(i)}>Page {i + 1}{d.meta?.template ? ` · ${d.meta.template}` : ''}</button>
        <button className="btn-ghost !p-1.5" aria-label={`Move page ${i + 1} up`} disabled={i === 0} onClick={() => ctx.setProject((p) => reorderPage(p, i, i - 1))}><ArrowLeft size={14} /></button>
        <button className="btn-ghost !p-1.5" aria-label={`Move page ${i + 1} down`} disabled={i === project.docs.length - 1} onClick={() => ctx.setProject((p) => reorderPage(p, i, i + 1))}><ArrowRight size={14} /></button>
        <button className="btn-ghost !p-1.5" aria-label={`Delete page ${i + 1}`} disabled={project.docs.length <= 1} onClick={() => { if (window.confirm(`Delete page ${i + 1}? This can’t be undone.`)) ctx.setProject((p) => deletePage(p, i)); }}><Trash2 size={14} /></button></li>)}</ul>
      <button className="btn-primary w-full" onClick={() => { ctx.setProject((p) => addPage(p, 'my-day')); }}><Plus size={16} /> Add page</button>
      <p className="text-xs text-muted">Export as PNG/JPEG exports the current page. “PDF” exports all pages.</p>
    </div>
  );
}

function Scrap() {
  const t = useSearchParams().get('template') ?? 'my-day';
  return <ProjectEditor type="scrapbook" multiPage defaultName="My scrapbook" initial={() => buildScrapbookPage(t)}
    tools={(ctx) => [{ id: 'template', label: 'Templates', icon: <BookHeart size={18} />, panel: <TemplatesPanel ctx={ctx} /> }, { id: 'photos', label: 'Pages', icon: <FileText size={18} />, panel: <PagesPanel ctx={ctx} /> }]} />;
}
export default function Page() { return <Suspense><Scrap /></Suspense>; }
