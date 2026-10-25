'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Undo2, Redo2, Download, Save, ZoomIn, ZoomOut, Maximize, Eye, Sparkles, Sticker, Type, Palette, SlidersHorizontal, ImagePlus, Heart } from 'lucide-react';
import { EditorCanvas } from './EditorCanvas.tsx';
import { BackgroundPanel, FilterPanel, PropertiesPanel, StickerPanel, TextPanel } from './Panels.tsx';
import { ExportDialog } from './ExportDialog.tsx';
import type { EditorApi } from '../../hooks/useEditor.ts';
import { loadBitmap, ImageLoadError } from '../../lib/runtime.ts';
import { registerBlob } from '../../lib/blobs.ts';
import { fillPhotoSlots, uid, updateLayer } from '../../lib/editor/model.ts';
import type { Doc } from '../../lib/editor/model.ts';

export type ToolId = 'filters' | 'stickers' | 'text' | 'background' | 'template' | 'photos';

interface Props {
  editor: EditorApi;
  projectName: string;
  onRename?: (n: string) => void;
  /** extra left-panel tabs supplied by the host page (templates, layouts, frames…) */
  extraTools?: Array<{ id: ToolId; label: string; icon: React.ReactNode; panel: React.ReactNode }>;
  onSave?: () => Promise<void> | void;
  saveLabel?: string;
  allDocs?: Doc[];
  topRight?: React.ReactNode;
  statusLine?: string;
}

const BASE_TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  { id: 'filters', label: 'Filters', icon: <SlidersHorizontal size={18} /> }, { id: 'stickers', label: 'Stickers', icon: <Sticker size={18} /> },
  { id: 'text', label: 'Text', icon: <Type size={18} /> }, { id: 'background', label: 'Background', icon: <Palette size={18} /> },
];

export function EditorShell({ editor, projectName, onRename, extraTools = [], onSave, saveLabel = 'Save', allDocs, topRight, statusLine }: Props) {
  const [tool, setTool] = useState<ToolId>(extraTools[0]?.id ?? 'filters');
  const [zoom, setZoom] = useState(1);
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const tools = useMemo(() => [...extraTools.map((t) => ({ id: t.id, label: t.label, icon: t.icon })), ...BASE_TOOLS, { id: 'photos' as ToolId, label: 'Photos', icon: <ImagePlus size={18} /> }], [extraTools]);

  const addFiles = useCallback(async (files: File[], layerId: string | null = null) => {
    setNotice(null);
    const keys: string[] = [];
    for (const f of files) {
      try { const bmp = await loadBitmap(f); const k = uid('img'); registerBlob(k, f); editor.addImage(k, bmp); keys.push(k); }
      catch (e) { setNotice(e instanceof ImageLoadError ? e.message : 'Could not load that image.'); }
    }
    if (!keys.length) return;
    editor.update((d) => (layerId ? updateLayer(d, layerId, { src: keys[0] } as never) : fillPhotoSlots(d, keys, true)));
  }, [editor]);

  // keyboard shortcuts (desktop)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); editor.redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selected) { e.preventDefault(); const id = editor.selected; editor.update((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) })); editor.setSelected(null); }
      else if (editor.selected && e.key.startsWith('Arrow')) {
        e.preventDefault(); const step = e.shiftKey ? 20 : 4; const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0; const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0; const id = editor.selected;
        editor.update((d) => { const l = d.layers.find((x) => x.id === id); return l ? updateLayer(d, id, { x: l.x + dx, y: l.y + dy }) : d; }, `nudge-${id}`);
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (editor.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [editor.dirty]);

  const doSave = async () => { if (!onSave) return; setSaving(true); setNotice(null); try { await onSave(); editor.markSaved(); } catch (e) { setNotice((e as Error).message || 'Save failed.'); } finally { setSaving(false); } };

  const panel = (() => {
    const extra = extraTools.find((t) => t.id === tool); if (extra) return extra.panel;
    switch (tool) {
      case 'filters': return <FilterPanel editor={editor} />;
      case 'stickers': return <StickerPanel editor={editor} />;
      case 'text': return <TextPanel editor={editor} />;
      case 'background': return <BackgroundPanel editor={editor} />;
      case 'photos': return <div className="space-y-2"><button className="btn-primary w-full" onClick={() => fileRef.current?.click()}><ImagePlus size={16} /> Add photos from device</button><p className="text-xs text-muted">Photos stay on your device. You can also drag files onto the canvas.</p></div>;
      default: return null;
    }
  })();

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-soft/40">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      {/* top toolbar */}
      <div className="flex items-center gap-2 border-b border-blush/40 bg-surface px-3 py-2">
        <Link href="/" className="hidden items-center gap-1 font-display text-lg text-rose sm:flex" aria-label="BlushCam home"><Heart size={16} fill="currentColor" /> BlushCam</Link>
        <input aria-label="Project name" className="input !w-40 sm:!w-56" value={projectName} onChange={(e) => onRename?.(e.target.value)} maxLength={120} />
        {editor.dirty && <span className="text-xs text-rose" aria-live="polite">● unsaved</span>}
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost !p-2" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!editor.canUndo} onClick={editor.undo}><Undo2 size={18} /></button>
          <button className="btn-ghost !p-2" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!editor.canRedo} onClick={editor.redo}><Redo2 size={18} /></button>
          <button className="btn-ghost !p-2" aria-label="Hold to compare with original" title="Hold to see original"
            onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)} onKeyDown={(e) => e.key === ' ' && setCompare(true)} onKeyUp={() => setCompare(false)}><Eye size={18} /></button>
          {topRight}
          {onSave && <button className="btn-soft" disabled={saving} onClick={doSave}><Save size={16} /><span className="hidden sm:inline">{saving ? 'Saving…' : saveLabel}</span></button>}
          <button className="btn-primary" onClick={() => setExporting(true)}><Download size={16} /><span className="hidden sm:inline">Export</span></button>
        </div>
      </div>
      {notice && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{notice}</p>}
      <div className="flex min-h-0 flex-1">
        {/* left: tools (desktop) */}
        <nav aria-label="Tools" className="hidden w-20 shrink-0 flex-col gap-1 border-r border-blush/40 bg-surface p-2 md:flex">
          {tools.map((t) => <button key={t.id} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={`flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-semibold ${tool === t.id ? 'bg-rose text-white' : 'text-muted hover:bg-soft'}`}>{t.icon}{t.label}</button>)}
        </nav>
        <aside aria-label="Tool options" className="hidden w-72 shrink-0 overflow-y-auto border-r border-blush/40 bg-surface p-4 md:block">{panel}</aside>
        {/* centre */}
        <main className="relative min-w-0 flex-1">
          <EditorCanvas editor={editor} zoom={zoom} showOriginal={compare} onDropFiles={(f, id) => void addFiles(f, id)} />
          {compare && <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs text-white">Original</span>}
        </main>
        {/* right: properties (desktop) */}
        <aside aria-label="Properties" className="hidden w-72 shrink-0 overflow-y-auto border-l border-blush/40 bg-surface p-4 lg:block">
          <h3 className="mb-3 flex items-center gap-1 font-display text-lg"><Sparkles size={16} className="text-rose" /> Selected</h3>
          <PropertiesPanel editor={editor} />
        </aside>
      </div>
      {/* bottom: zoom / size */}
      <div className="flex items-center gap-2 border-t border-blush/40 bg-surface px-3 py-1.5 text-xs text-muted">
        <button className="btn-ghost !p-1.5" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut size={16} /></button>
        <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="btn-ghost !p-1.5" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn size={16} /></button>
        <button className="btn-ghost !p-1.5" aria-label="Fit to screen" onClick={() => setZoom(1)}><Maximize size={16} /></button>
        <span className="ml-auto">{editor.doc.width} × {editor.doc.height}px {statusLine ? `· ${statusLine}` : ''}</span>
      </div>
      {/* mobile: bottom sheet + tool nav */}
      <div className="md:hidden">
        {sheetOpen && <div className="max-h-[42dvh] overflow-y-auto border-t border-blush/40 bg-surface p-4" role="region" aria-label="Tool options">{panel}{editor.selected && <div className="mt-4 border-t border-blush/40 pt-4"><PropertiesPanel editor={editor} /></div>}</div>}
        <nav aria-label="Tools" className="flex overflow-x-auto border-t border-blush/40 bg-surface">
          {tools.map((t) => <button key={t.id} aria-pressed={tool === t.id && sheetOpen} onClick={() => { if (tool === t.id) setSheetOpen((o) => !o); else { setTool(t.id); setSheetOpen(true); } }} className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-semibold ${tool === t.id && sheetOpen ? 'text-rose' : 'text-muted'}`}>{t.icon}{t.label}</button>)}
        </nav>
      </div>
      {exporting && <ExportDialog editor={editor} name={projectName} allDocs={allDocs} onClose={() => setExporting(false)} />}
    </div>
  );
}
