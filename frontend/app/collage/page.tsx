'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, ImagePlus } from 'lucide-react';
import { ProjectEditor } from '../../features/editor/ProjectEditor.tsx';
import { COLLAGE_ASPECTS, COLLAGE_LAYOUTS, DEFAULT_COLLAGE_STYLE, addCollagePhoto, buildCollageDoc, changeCollageAspect, relayoutCollage } from '../../features/collage/layouts.ts';
import type { CollageLayoutId, CollageStyle } from '../../features/collage/layouts.ts';
import { Slider } from '../../features/editor/Panels.tsx';
import type { ToolCtx } from '../../features/editor/ProjectEditor.tsx';

function CollagePanel({ ctx }: { ctx: ToolCtx }) {
  const { editor } = ctx; const [style, setStyle] = useState<CollageStyle>(DEFAULT_COLLAGE_STYLE);
  const layout = (editor.doc.meta?.layout ?? 'grid4') as CollageLayoutId;
  const restyle = (patch: Partial<CollageStyle>) => { const s = { ...style, ...patch }; setStyle(s); editor.update((d) => relayoutCollage(d, layout, s), 'collage-style'); };
  return (
    <div className="space-y-4">
      <div><span className="label">Layout (your photos are kept)</span><div className="grid grid-cols-2 gap-2">{(Object.keys(COLLAGE_LAYOUTS) as CollageLayoutId[]).map((id) => <button key={id} className="chip justify-center py-2" aria-pressed={layout === id} onClick={() => editor.update((d) => relayoutCollage(d, id, style))}>{COLLAGE_LAYOUTS[id].label}</button>)}</div></div>
      <div><span className="label">Aspect ratio</span><div className="flex flex-wrap gap-1.5">{COLLAGE_ASPECTS.map((a) => <button key={a.id} className="chip" aria-pressed={editor.doc.meta?.aspect === a.id} onClick={() => editor.update((d) => changeCollageAspect(d, a.id, style))}>{a.id}</button>)}</div></div>
      <Slider label="Spacing" value={style.spacing} min={0} max={60} onChange={(v) => restyle({ spacing: v })} />
      <Slider label="Corner radius" value={style.radius} min={0} max={120} onChange={(v) => restyle({ radius: v })} />
      <Slider label="Border" value={style.borderWidth} min={0} max={40} onChange={(v) => restyle({ borderWidth: v })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={style.shadow} onChange={(e) => restyle({ shadow: e.target.checked })} /> Shadows</label>
      <label className="btn-primary w-full cursor-pointer"><ImagePlus size={16} /> Add photos<input type="file" multiple hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const keys = await ctx.addPhotos([...(e.target.files ?? [])]); keys.forEach((k) => editor.update((d) => addCollagePhoto(d, k))); e.target.value = ''; }} /></label>
      {(editor.doc.spare?.length ?? 0) > 0 && <p className="text-xs text-muted">{editor.doc.spare!.length} extra photo(s) are saved and will return when you choose a layout with more slots.</p>}
      <p className="text-xs text-muted">Tip: select a photo, then use “Photos” settings to zoom and reposition inside its frame.</p>
    </div>
  );
}

function Collage() {
  const p = useSearchParams(); const id = (p.get('layout') as CollageLayoutId) in COLLAGE_LAYOUTS ? (p.get('layout') as CollageLayoutId) : 'grid4';
  return <ProjectEditor type="collage" defaultName="My collage" initial={() => buildCollageDoc(id, '4:5', [])} tools={(ctx) => [{ id: 'template', label: 'Layout', icon: <LayoutGrid size={18} />, panel: <CollagePanel ctx={ctx} /> }]} />;
}
export default function Page() { return <Suspense><Collage /></Suspense>; }
