'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderDoc } from '../../lib/editor/render.ts';
import type { RenderEnv } from '../../lib/editor/render.ts';
import { photoLayer, stickerLayer, addLayer, updateLayer } from '../../lib/editor/model.ts';
import type { Doc, Layer } from '../../lib/editor/model.ts';
import { DEFAULT_FILTER_STATE } from '../filters/presets.ts';
import { preloadStickers, rasterSticker } from '../../lib/runtime.ts';
import type { EditorApi } from '../../hooks/useEditor.ts';

interface Props { editor: EditorApi; zoom: number; showOriginal?: boolean; onDropFiles?: (files: File[], layerId: string | null) => void; className?: string }

type Drag =
  | { mode: 'move'; id: string; sx: number; sy: number; ox: number; oy: number }
  | { mode: 'resize'; id: string; sx: number; sy: number; ow: number; oh: number; ratio: number; lock: boolean }
  | { mode: 'rotate'; id: string; cx: number; cy: number; off: number };

export function EditorCanvas({ editor, zoom, showOriginal, onDropFiles, className }: Props) {
  const { doc, images, selected, setSelected, update } = editor;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 600, h: 600 });
  const [stickersReady, setStickersReady] = useState(0);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(0.05, Math.min((box.w - 24) / doc.width, (box.h - 24) / doc.height));
  const s = fit * zoom;           // CSS px per doc unit
  const cssW = Math.round(doc.width * s), cssH = Math.round(doc.height * s);

  useEffect(() => { let alive = true; preloadStickers(doc).then(() => alive && setStickersReady((n) => n + 1)); return () => { alive = false; }; }, [doc.layers.length, doc]);

  // Paint (rAF-throttled). Uses the exact renderer the exporter uses.
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(cssW * dpr)), H = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== W) c.width = W; if (c.height !== H) c.height = H;
    const id = requestAnimationFrame(() => {
      const ctx = c.getContext('2d'); if (!ctx) return;
      const env: RenderEnv = {
        images: images as never, placeholders: true,
        createCanvas: (w, h) => { const o = document.createElement('canvas'); o.width = w; o.height = h; return o as never; },
        sticker: (sid, col) => (cacheGet(sid, col) as never),
      };
      const view: Doc = showOriginal ? { ...doc, filter: { ...DEFAULT_FILTER_STATE }, layers: doc.layers.map((l) => (l.kind === 'photo' ? { ...l, filter: undefined } : l)) } : doc;
      try { renderDoc(env, view, ctx, { width: W, height: H, dx: 0, dy: 0, dw: W, dh: H, scale: W / doc.width, format: 'png', quality: 1 }); }
      catch { /* surfaced on export; preview just skips the frame */ }
    });
    return () => cancelAnimationFrame(id);
  }, [doc, images, cssW, cssH, showOriginal, stickersReady]);

  /* ---------- pointer interactions ---------- */
  const toDoc = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };
  const sel = useMemo(() => doc.layers.find((l) => l.id === selected) ?? null, [doc.layers, selected]);

  const begin = (e: React.PointerEvent, l: Layer, mode: 'move' | 'resize' | 'rotate') => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(l.id);
    const p = toDoc(e);
    if (l.locked && mode !== 'move') return;
    if (mode === 'move') drag.current = { mode, id: l.id, sx: p.x, sy: p.y, ox: l.x, oy: l.y };
    else if (mode === 'resize') drag.current = { mode, id: l.id, sx: p.x, sy: p.y, ow: l.w, oh: l.h, ratio: l.w / l.h, lock: l.kind === 'sticker' };
    else { const cx = l.x + l.w / 2, cy = l.y + l.h / 2; drag.current = { mode, id: l.id, cx, cy, off: l.rotation - (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI }; }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = toDoc(e);
    if (d.mode === 'move') update((doc) => updateLayer(doc, d.id, { x: d.ox + (p.x - d.sx), y: d.oy + (p.y - d.sy) }), `move-${d.id}`);
    else if (d.mode === 'resize') {
      let w = Math.max(24, d.ow + (p.x - d.sx)), h = Math.max(24, d.oh + (p.y - d.sy));
      if (d.lock) h = w / d.ratio;
      update((doc) => updateLayer(doc, d.id, { w, h }), `resize-${d.id}`);
    } else {
      let a = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI + d.off;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      update((doc) => updateLayer(doc, d.id, { rotation: Math.round(a * 10) / 10 }), `rot-${d.id}`);
    }
  };
  const end = () => { drag.current = null; };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const p = toDoc(e);
    const stickerId = e.dataTransfer.getData('application/x-blushcam-sticker');
    if (stickerId) {
      await rasterSticker(stickerId, '#D96C93');
      update((d) => addLayer(d, stickerLayer({ stickerId, color: '#D96C93', x: p.x - 80, y: p.y - 80, w: 160, h: 160 })));
      return;
    }
    if (e.dataTransfer.files.length) {
      const hit = [...doc.layers].reverse().find((l) => l.kind === 'photo' && p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h);
      onDropFiles?.([...e.dataTransfer.files], hit?.id ?? null);
    }
  };

  return (
    <div ref={wrapRef} className={`relative flex h-full w-full items-center justify-center overflow-auto ${className ?? ''}`} onPointerDown={() => setSelected(null)}
      onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="relative shrink-0 shadow-soft" style={{ width: cssW, height: cssH, background: 'repeating-conic-gradient(#f3e6ee 0% 25%, #fff 0% 50%) 0 0/16px 16px' }}>
        <canvas ref={canvasRef} role="img" aria-label="Design preview" style={{ width: cssW, height: cssH, display: 'block' }} />
        <div className="touch-none-canvas absolute inset-0" onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
          {doc.layers.map((l) => (
            <div key={l.id} role="button" tabIndex={-1} aria-label={`${l.kind} layer`}
              onPointerDown={(e) => begin(e, l, 'move')}
              style={{ position: 'absolute', left: l.x * s, top: l.y * s, width: l.w * s, height: l.h * s, transform: `rotate(${l.rotation}deg)`, cursor: l.locked ? 'default' : 'move',
                outline: selected === l.id ? '2px solid rgb(217 108 147)' : 'none', outlineOffset: 2 }}>
              {selected === l.id && !l.locked && <>
                <span onPointerDown={(e) => begin(e, l, 'resize')} aria-label="Resize" className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-rose bg-white" />
                <span onPointerDown={(e) => begin(e, l, 'rotate')} aria-label="Rotate" className="absolute -top-9 left-1/2 h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-rose bg-white" />
                <span className="pointer-events-none absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-rose" />
              </>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// small indirection so the painter reads the sticker cache populated by preloadStickers
import { makeExportEnv } from '../../lib/runtime.ts';
const _env = makeExportEnv({});
function cacheGet(id: string, color?: string) { return _env.sticker(id, color); }
void photoLayer;
