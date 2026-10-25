'use client';
import { Suspense, use } from 'react';
import { ProjectEditor } from '../../../features/editor/ProjectEditor.tsx';
import { newDoc } from '../../../lib/editor/model.ts';

function Open({ id }: { id: string }) {
  // The real document is loaded from the API (authorisation enforced server-side); this placeholder is replaced on load.
  return <ProjectEditor key={id} cloud={{ id }} type="photo" defaultName="Loading…" initial={() => newDoc('photo', 1080, 1350)} multiPage />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <Suspense><Open id={id} /></Suspense>; }
