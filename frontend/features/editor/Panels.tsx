'use client';
import { useState } from 'react';
import { Copy, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Lock, Unlock } from 'lucide-react';
import { FILTER_CATEGORIES, FILTER_PRESETS, DEFAULT_FILTER_STATE } from '../filters/presets.ts';
import type { FilterCategory, FilterState } from '../filters/types.ts';
import { STICKERS, STICKER_COLLECTIONS, stickerDataUrl, DEFAULT_STICKER_COLOR } from '../stickers/catalog.ts';
import { addLayer, duplicateLayer, moveLayer, removeLayer, stickerLayer, textLayer, updateLayer } from '../../lib/editor/model.ts';
import type { Doc, Layer, PhotoLayer, TextLayer } from '../../lib/editor/model.ts';
import { rasterSticker } from '../../lib/runtime.ts';
import type { EditorApi } from '../../hooks/useEditor.ts';

export function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const id = `sl-${label.replace(/\W/g, '')}`;
  return (
    <div>
      <div className="flex justify-between"><label htmlFor={id} className="label">{label}</label><span className="text-xs tabular-nums text-muted">{Math.round(value * 10) / 10}</span></div>
      <input id={id} type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function FilterPanel({ editor }: { editor: EditorApi }) {
  const { doc, update } = editor;
  const [cat, setCat] = useState<FilterCategory>('natural');
  const f = doc.filter;
  const set = (patch: Partial<FilterState>, key?: string) => update((d) => ({ ...d, filter: { ...d.filter, ...patch } }), key ?? null);
  const adj = (k: keyof FilterState['adjust']) => (v: number) => set({ adjust: { ...f.adjust, [k]: v } }, `adj-${k}`);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Filter categories" className="flex flex-wrap gap-1.5">
        {FILTER_CATEGORIES.map((c) => <button key={c.id} role="tab" aria-selected={cat === c.id} className="chip" onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="chip justify-center py-2" aria-pressed={f.presetId === null} onClick={() => set({ presetId: null })}>None</button>
        {FILTER_PRESETS.filter((p) => p.category === cat).map((p) => (
          <button key={p.id} aria-pressed={f.presetId === p.id} onClick={() => set({ presetId: p.id })}
            className={`rounded-xl border p-1 text-center text-[11px] font-semibold transition ${f.presetId === p.id ? 'border-rose bg-soft' : 'border-blush/50 bg-surface hover:border-rose'}`}>
            <span className="mb-1 block h-10 rounded-lg" style={{ background: 'linear-gradient(135deg,#f7c9a6,#8fb0d8 60%,#6b7a6a)', filter: p.thumbCss }} aria-hidden />
            {p.name}
          </button>
        ))}
      </div>
      <Slider label="Filter strength" value={f.strength} min={0} max={100} onChange={(v) => set({ strength: v }, 'strength')} />
      <details className="rounded-xl border border-blush/50 p-3" open>
        <summary className="cursor-pointer text-sm font-semibold">Adjustments</summary>
        <div className="mt-3 space-y-3">
          <Slider label="Brightness" value={f.adjust.brightness ?? 0} min={-100} max={100} onChange={adj('brightness')} />
          <Slider label="Contrast" value={f.adjust.contrast ?? 0} min={-100} max={100} onChange={adj('contrast')} />
          <Slider label="Saturation" value={f.adjust.saturation ?? 0} min={-100} max={100} onChange={adj('saturation')} />
          <Slider label="Temperature" value={f.adjust.temperature ?? 0} min={-100} max={100} onChange={adj('temperature')} />
          <Slider label="Tint" value={f.adjust.tint ?? 0} min={-100} max={100} onChange={adj('tint')} />
          <Slider label="Blur" value={f.adjust.blur ?? 0} min={0} max={12} step={0.5} onChange={adj('blur')} />
          <Slider label="Vignette" value={f.adjust.vignette ?? 0} min={0} max={100} onChange={adj('vignette')} />
          <Slider label="Grain overlay" value={f.grainOverlay} min={0} max={100} onChange={(v) => set({ grainOverlay: v }, 'grain')} />
          <Slider label="Light leak overlay" value={f.lightLeak} min={0} max={100} onChange={(v) => set({ lightLeak: v }, 'leak')} />
        </div>
      </details>
      <button className="btn-soft w-full" onClick={() => update((d) => ({ ...d, filter: { ...DEFAULT_FILTER_STATE, adjust: {} } }))}>Reset adjustments</button>
    </div>
  );
}

export function StickerPanel({ editor }: { editor: EditorApi }) {
  const [col, setCol] = useState<string>(STICKER_COLLECTIONS[0].id);
  const [color, setColor] = useState(DEFAULT_STICKER_COLOR);
  const add = async (id: string) => {
    await rasterSticker(id, color);
    const { doc } = editor; const size = Math.round(Math.min(doc.width, doc.height) * 0.22);
    const l = stickerLayer({ stickerId: id, color, x: doc.width / 2 - size / 2, y: doc.height / 2 - size / 2, w: size, h: size });
    editor.update((d) => addLayer(d, l)); editor.setSelected(l.id);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sticker collections">
        {STICKER_COLLECTIONS.map((c) => <button key={c.id} role="tab" aria-selected={col === c.id} className="chip" onClick={() => setCol(c.id)}>{c.label}</button>)}
      </div>
      <div className="flex items-center gap-2"><label className="label !mb-0" htmlFor="stk-color">Colour</label><input id="stk-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded" /></div>
      <div className="grid grid-cols-4 gap-2">
        {STICKERS.filter((s) => s.collection === col).map((s) => (
          <button key={s.id} className="aspect-square rounded-xl border border-blush/50 bg-surface p-2 transition hover:border-rose" aria-label={`Add ${s.name} sticker`} draggable
            onDragStart={(e) => e.dataTransfer.setData('application/x-blushcam-sticker', s.id)} onClick={() => add(s.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stickerDataUrl(s.id, color) ?? ''} alt="" className="h-full w-full" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

export const FONTS = [
  { label: 'Quicksand', css: 'Quicksand, system-ui, sans-serif' }, { label: 'Playfair', css: '"Playfair Display", Georgia, serif' },
  { label: 'Caveat (handwriting)', css: '"Caveat", "Comic Sans MS", cursive' }, { label: 'Courier', css: '"Courier New", monospace' },
];

export function TextPanel({ editor }: { editor: EditorApi }) {
  const add = () => {
    const { doc } = editor;
    const l = textLayer({ text: 'your text', x: doc.width * 0.1, y: doc.height * 0.45, w: doc.width * 0.8, fontSize: Math.round(doc.width * 0.08) });
    editor.update((d) => addLayer(d, l)); editor.setSelected(l.id);
  };
  return <div className="space-y-2"><button className="btn-primary w-full" onClick={add}>Add text</button><p className="text-xs text-muted">Select a text layer to edit its words, font, size, colour and alignment.</p></div>;
}

export function PropertiesPanel({ editor }: { editor: EditorApi }) {
  const l = editor.doc.layers.find((x) => x.id === editor.selected);
  if (!l) return <p className="text-sm text-muted">Select something on the canvas to edit it.</p>;
  const patch = (p: Partial<Layer>, key?: string) => editor.update((d) => updateLayer(d, l.id, p as never), key ?? null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <IconBtn label="Duplicate" onClick={() => editor.update((d) => { const r = duplicateLayer(d, l.id); if (r.newId) editor.setSelected(r.newId); return r.doc; })}><Copy size={16} /></IconBtn>
        <IconBtn label="Bring forward" onClick={() => editor.update((d) => moveLayer(d, l.id, 'forward'))}><ArrowUp size={16} /></IconBtn>
        <IconBtn label="Send backward" onClick={() => editor.update((d) => moveLayer(d, l.id, 'backward'))}><ArrowDown size={16} /></IconBtn>
        <IconBtn label="Bring to front" onClick={() => editor.update((d) => moveLayer(d, l.id, 'front'))}><ChevronsUp size={16} /></IconBtn>
        <IconBtn label="Send to back" onClick={() => editor.update((d) => moveLayer(d, l.id, 'back'))}><ChevronsDown size={16} /></IconBtn>
        <IconBtn label={l.locked ? 'Unlock' : 'Lock'} onClick={() => patch({ locked: !l.locked })}>{l.locked ? <Unlock size={16} /> : <Lock size={16} />}</IconBtn>
        <IconBtn label="Delete" onClick={() => { editor.update((d) => removeLayer(d, l.id)); editor.setSelected(null); }}><Trash2 size={16} /></IconBtn>
      </div>
      <Slider label="Opacity" value={Math.round(l.opacity * 100)} min={5} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'opacity')} />
      <Slider label="Rotation" value={l.rotation} min={-180} max={180} onChange={(v) => patch({ rotation: v }, 'rotation')} />
      {l.kind === 'sticker' && <div><label className="label" htmlFor="p-col">Colour</label><input id="p-col" type="color" value={l.color ?? DEFAULT_STICKER_COLOR} onChange={async (e) => { await rasterSticker(l.stickerId, e.target.value); patch({ color: e.target.value } as Partial<Layer>); }} className="h-8 w-14 rounded" /></div>}
      {l.kind === 'text' && <TextProps l={l} patch={patch} />}
      {l.kind === 'photo' && <PhotoProps l={l} patch={patch} />}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button className="btn-soft !p-2" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function TextProps({ l, patch }: { l: TextLayer; patch: (p: Partial<Layer>, k?: string) => void }) {
  return (
    <div className="space-y-3">
      <div><label className="label" htmlFor="t-text">Text</label><textarea id="t-text" className="input" rows={3} value={l.text} maxLength={400} onChange={(e) => patch({ text: e.target.value } as Partial<Layer>, 'text')} /></div>
      <div><label className="label" htmlFor="t-font">Font</label>
        <select id="t-font" className="input" value={l.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value } as Partial<Layer>)}>{FONTS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}</select></div>
      <Slider label="Size" value={l.fontSize} min={12} max={240} onChange={(v) => patch({ fontSize: v, h: v * 1.3 } as Partial<Layer>, 'fs')} />
      <div className="flex items-center gap-3">
        <input aria-label="Text colour" type="color" value={l.color} onChange={(e) => patch({ color: e.target.value } as Partial<Layer>, 'tc')} className="h-8 w-12 rounded" />
        {(['left', 'center', 'right'] as const).map((a) => <button key={a} className="chip" aria-pressed={l.align === a} onClick={() => patch({ align: a } as Partial<Layer>)}>{a}</button>)}
      </div>
    </div>
  );
}

function PhotoProps({ l, patch }: { l: PhotoLayer; patch: (p: Partial<Layer>, k?: string) => void }) {
  return (
    <div className="space-y-3">
      <Slider label="Zoom" value={l.crop.zoom} min={1} max={4} step={0.05} onChange={(v) => patch({ crop: { ...l.crop, zoom: v } } as Partial<Layer>, 'zoom')} />
      <Slider label="Pan horizontally" value={l.crop.offsetX} min={-1} max={1} step={0.02} onChange={(v) => patch({ crop: { ...l.crop, offsetX: v } } as Partial<Layer>, 'px')} />
      <Slider label="Pan vertically" value={l.crop.offsetY} min={-1} max={1} step={0.02} onChange={(v) => patch({ crop: { ...l.crop, offsetY: v } } as Partial<Layer>, 'py')} />
      <Slider label="Corner radius" value={l.radius} min={0} max={160} onChange={(v) => patch({ radius: v } as Partial<Layer>, 'rad')} />
      <Slider label="Border" value={l.border.width} min={0} max={60} onChange={(v) => patch({ border: { ...l.border, width: v } } as Partial<Layer>, 'bw')} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.shadow} onChange={(e) => patch({ shadow: e.target.checked } as Partial<Layer>)} /> Shadow</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!l.mirror} onChange={(e) => patch({ mirror: e.target.checked } as Partial<Layer>)} /> Mirror photo</label>
      {l.src && <button className="btn-soft w-full" onClick={() => patch({ src: null } as Partial<Layer>)}>Clear photo</button>}
    </div>
  );
}

export function BackgroundPanel({ editor }: { editor: EditorApi }) {
  const set = (background: Doc['background']) => editor.update((d) => ({ ...d, background }));
  const swatches = ['#FFF9F3', '#FCE4EC', '#F8BBD0', '#E9DDFB', '#DDF5E8', '#FFFFFF', '#352B35'];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{swatches.map((c) => <button key={c} aria-label={`Background ${c}`} className="h-8 w-8 rounded-full border border-blush" style={{ background: c }} onClick={() => set({ kind: 'solid', color: c })} />)}
        <input aria-label="Custom background colour" type="color" className="h-8 w-10 rounded" onChange={(e) => set({ kind: 'solid', color: e.target.value })} /></div>
      <div className="flex flex-wrap gap-1.5">
        {(['dots', 'grid', 'stripes', 'paper'] as const).map((p) => <button key={p} className="chip" onClick={() => set({ kind: 'pattern', base: '#FFF9F3', pattern: p, ink: '#F4C2D4' })}>{p}</button>)}
        <button className="chip" onClick={() => set({ kind: 'transparent' })}>transparent (PNG/WebP)</button>
      </div>
    </div>
  );
}
