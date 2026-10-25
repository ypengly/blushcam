'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { canRedo, canUndo, commit as hCommit, createHistory, redo as hRedo, undo as hUndo } from '../lib/editor/model.ts';
import type { Doc } from '../lib/editor/model.ts';
import type { Bitmap } from '../lib/runtime.ts';

/** Single editing state used by every editor surface (photo, booth, collage, scrapbook). */
export function useEditor(initial: Doc) {
  const [hist, setHist] = useState(() => createHistory(initial));
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [images, setImages] = useState<Record<string, Bitmap>>({});
  const imagesRef = useRef(images); imagesRef.current = images;

  const update = useCallback((fn: (d: Doc) => Doc, coalesceKey: string | null = null) => {
    setHist((h) => hCommit(h, fn(h.present), coalesceKey));
    setDirty(true);
  }, []);
  const replace = useCallback((d: Doc) => { setHist(createHistory(d)); setSelected(null); setDirty(false); }, []);
  const undo = useCallback(() => { setHist(hUndo); setDirty(true); }, []);
  const redo = useCallback(() => { setHist(hRedo); setDirty(true); }, []);
  const addImage = useCallback((key: string, bmp: Bitmap) => setImages((m) => ({ ...m, [key]: bmp })), []);
  const markSaved = useCallback(() => setDirty(false), []);

  return useMemo(() => ({
    doc: hist.present, update, replace, undo, redo, canUndo: canUndo(hist), canRedo: canRedo(hist),
    selected, setSelected, dirty, markSaved, images, addImage,
  }), [hist, update, replace, undo, redo, selected, dirty, markSaved, images, addImage]);
}
export type EditorApi = ReturnType<typeof useEditor>;
