'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Cloud } from 'lucide-react';
import { EditorShell } from './EditorShell.tsx';
import type { ToolId } from './EditorShell.tsx';
import { useEditor } from '../../hooks/useEditor.ts';
import type { EditorApi } from '../../hooks/useEditor.ts';
import { useUser } from '../../hooks/useUser.ts';
import { handoffTake, registerBlob } from '../../lib/blobs.ts';
import { uid, fillPhotoSlots } from '../../lib/editor/model.ts';
import type { Doc, Project, ProjectType } from '../../lib/editor/model.ts';
import { loadBitmap, preloadStickers, makeExportEnv } from '../../lib/runtime.ts';
import { renderDoc } from '../../lib/editor/render.ts';
import { loadCloud, loadLocal, saveCloud, saveLocal } from '../gallery/persist.ts';

export interface ToolCtx { editor: EditorApi; project: Project; setProject: (fn: (p: Project) => Project) => void; pageIndex: number; setPageIndex: (i: number) => void; addPhotos: (files: Blob[]) => Promise<string[]> }

interface Props {
  type: ProjectType;
  initial: () => Doc;
  defaultName: string;
  tools?: (ctx: ToolCtx) => Array<{ id: ToolId; label: string; icon: React.ReactNode; panel: React.ReactNode }>;
  /** consume photos handed off from the camera page */
  acceptHandoff?: boolean;
  multiPage?: boolean;
  topRight?: (ctx: ToolCtx) => React.ReactNode;
  /** photos to place into empty slots on mount (camera handoff, booth session, uploads) */
  seedPhotos?: Blob[];
  /** open a project saved in the cloud */
  cloud?: { id: string };
}

export function ProjectEditor({ type, initial, defaultName, tools, acceptHandoff, multiPage, topRight, seedPhotos, cloud }: Props) {
  const params = useSearchParams();
  const { user } = useUser();
  const [project, setProjectState] = useState<Project>(() => ({ id: uid('proj'), name: defaultName, type, docs: [initial()] }));
  const [pageIndex, setPageIndexState] = useState(0);
  const editor = useEditor(project.docs[0]);
  const cloudId = useRef<string | null>(null);
  const assetMap = useRef<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  // keep project.docs[pageIndex] in sync with the editor's present doc
  const docs = useMemo(() => project.docs.map((d, i) => (i === pageIndex ? editor.doc : d)), [project.docs, pageIndex, editor.doc]);
  const current: Project = useMemo(() => ({ ...project, docs }), [project, docs]);

  const setProject = useCallback((fn: (p: Project) => Project) => {
    setProjectState((p) => {
      const synced = { ...p, docs: p.docs.map((d, i) => (i === pageIndex ? editor.doc : d)) };
      const next = fn(synced);
      return next;
    });
  }, [pageIndex, editor.doc]);

  const setPageIndex = useCallback((i: number) => {
    setProjectState((p) => {
      const synced = p.docs.map((d, idx) => (idx === pageIndex ? editor.doc : d));
      editor.replace(synced[i] ?? synced[0]);
      return { ...p, docs: synced };
    });
    setPageIndexState(i);
  }, [pageIndex, editor]);

  // after structural project changes (add/delete/reorder page), reload editor with the page at index
  const lastLen = useRef(project.docs.length);
  useEffect(() => {
    if (project.docs.length !== lastLen.current) {
      lastLen.current = project.docs.length;
      const i = Math.min(pageIndex, project.docs.length - 1);
      if (i !== pageIndex) setPageIndexState(i);
      editor.replace(project.docs[i]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.docs.length]);

  const addPhotos = useCallback(async (blobs: Blob[]) => {
    const keys: string[] = [];
    for (const b of blobs) { const bmp = await loadBitmap(b); const k = uid('img'); registerBlob(k, b); editor.addImage(k, bmp); keys.push(k); }
    return keys;
  }, [editor]);

  // load a saved local project (?local=ID) or handoff photos from the camera
  useEffect(() => {
    let alive = true;
    (async () => {
      if (cloud) {
        const r = await loadCloud(cloud.id);
        if (alive) { cloudId.current = r.project.id; assetMap.current = r.assetMap; setProjectState(r.project); lastLen.current = r.project.docs.length; Object.entries(r.images).forEach(([k, v]) => editor.addImage(k, v)); editor.replace(r.project.docs[0]); }
        return;
      }
      const localId = params.get('local');
      if (localId) {
        const r = await loadLocal(localId);
        if (r && alive) { setProjectState(r.project); lastLen.current = r.project.docs.length; Object.entries(r.images).forEach(([k, v]) => editor.addImage(k, v)); editor.replace(r.project.docs[0]); }
        return;
      }
      if (seedPhotos?.length) {
        const keys = await addPhotos(seedPhotos);
        if (alive) editor.update((d) => fillPhotoSlots(d, keys, true));
        return;
      }
      if (acceptHandoff && params.get('from') === 'camera') {
        const blobs = await handoffTake();
        if (blobs.length && alive) { const keys = await addPhotos(blobs); editor.update((d) => fillPhotoSlots(d, keys, true)); }
      }
    })().catch(() => setMsg('Could not open that project.'));
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewCanvas = async (): Promise<HTMLCanvasElement | undefined> => {
    try {
      await preloadStickers(editor.doc);
      const env = makeExportEnv(editor.images); const k = 360 / Math.max(editor.doc.width, editor.doc.height);
      const c = document.createElement('canvas'); c.width = Math.round(editor.doc.width * k); c.height = Math.round(editor.doc.height * k);
      renderDoc(env, editor.doc, c.getContext('2d')!, { width: c.width, height: c.height, dx: 0, dy: 0, dw: c.width, dh: c.height, scale: k, format: 'png', quality: 1 });
      return c;
    } catch { return undefined; }
  };

  const saveBrowser = async () => { await saveLocal(current, await previewCanvas()); setMsg('Saved in this browser (not in the cloud).'); };
  const saveToCloud = async () => {
    if (!user) throw new Error('Sign in to save to your account.');
    if (!window.confirm('Upload this project’s photos to your BlushCam account? They stay private to you.')) return;
    const pc = await previewCanvas(); const pb = pc ? await new Promise<Blob | null>((res) => pc.toBlob(res, 'image/jpeg', 0.8)) : null;
    const r = await saveCloud(current, cloudId.current, assetMap.current, pb ?? undefined); cloudId.current = r.id; assetMap.current = r.assetMap; setMsg('Saved to your account.');
  };

  const ctx: ToolCtx = { editor, project: current, setProject, pageIndex, setPageIndex, addPhotos };
  return (
    <>
      <EditorShell editor={editor} projectName={project.name} onRename={(n) => setProjectState((p) => ({ ...p, name: n }))} onSave={saveBrowser} saveLabel="Save in browser"
        extraTools={tools?.(ctx)} allDocs={multiPage ? docs : undefined} statusLine={msg ?? undefined}
        topRight={<>{user && <button className="btn-soft" onClick={() => saveToCloud().catch((e) => setMsg((e as Error).message))}><Cloud size={16} /><span className="hidden sm:inline">Save to account</span></button>}{topRight?.(ctx)}</>} />
    </>
  );
}
