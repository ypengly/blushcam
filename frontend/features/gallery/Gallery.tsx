'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, List, Search, Copy, Trash2, Pencil, Cloud, HardDrive } from 'lucide-react';
import { api, ApiError } from '../../lib/api.ts';
import type { ProjectSummary } from '../../lib/api.ts';
import { localDelete, localList } from '../../lib/blobs.ts';

interface Row { key: string; id: string; where: 'cloud' | 'local'; name: string; type: ProjectSummary['projectType']; created: number; updated: number; thumb?: string | null }
const hrefFor = (r: Row) => (r.where === 'cloud' ? `/gallery/${r.id}` : `/${r.type === 'photo' ? 'studio' : r.type}?local=${r.id}`);

export function Gallery() {
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [type, setType] = useState<string>('all'); const [sort, setSort] = useState<'updated' | 'created'>('updated'); const [view, setView] = useState<'grid' | 'list'>('grid');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const out: Row[] = [];
    try { out.push(...(await localList()).map((p): Row => ({ key: `l-${p.id}`, id: p.id, where: 'local', name: p.name, type: p.type as Row['type'], created: p.createdAt, updated: p.updatedAt, thumb: p.thumb }))); } catch { /* IndexedDB unavailable */ }
    try { const r = await api<{ projects: ProjectSummary[] }>('/projects'); out.push(...r.projects.map((p): Row => ({ key: `c-${p.id}`, id: p.id, where: 'cloud', name: p.name, type: p.projectType, created: Date.parse(p.createdAt), updated: Date.parse(p.updatedAt), thumb: p.previewUrl }))); }
    catch (e) { if (!(e instanceof ApiError && e.status === 401)) setErr('Could not load your cloud projects right now. Browser-saved projects are shown.'); }
    setRows(out); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) => (type === 'all' || r.type === type) && r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (sort === 'updated' ? b.updated - a.updated : b.created - a.created)), [rows, q, type, sort]);

  const rename = async (r: Row) => { const n = window.prompt('Rename project', r.name)?.trim(); if (!n || n === r.name) return;
    try { if (r.where === 'cloud') await api(`/projects/${r.id}`, { method: 'PATCH', json: { name: n } }); else { const { localGet, localPut } = await import('../../lib/blobs.ts'); const p = await localGet(r.id); if (p) await localPut({ ...p, name: n, updatedAt: Date.now() }); } void load(); } catch (e) { setErr((e as Error).message); } };
  const dup = async (r: Row) => { try { if (r.where === 'cloud') await api(`/projects/${r.id}/duplicate`, { method: 'POST' }); else { const { localGet, localPut, blobGet, blobPut } = await import('../../lib/blobs.ts'); const p = await localGet(r.id); if (p) { const id = `${p.id}-copy-${Date.now().toString(36)}`; for (const k of p.blobKeys) { const b = await blobGet(p.id, k); if (b) await blobPut(id, k, b); } await localPut({ ...p, id, name: `${p.name} copy`, createdAt: Date.now(), updatedAt: Date.now() }); } } void load(); } catch (e) { setErr((e as Error).message); } };
  const del = async (r: Row) => { if (!window.confirm(`Delete “${r.name}”? This can’t be undone.`)) return; try { if (r.where === 'cloud') await api(`/projects/${r.id}`, { method: 'DELETE' }); else await localDelete(r.id); void load(); } catch (e) { setErr((e as Error).message); } };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[12rem] flex-1"><Search size={16} className="absolute left-3 top-3 text-muted" /><label className="sr-only" htmlFor="gq">Search projects</label><input id="gq" className="input !pl-9" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="text-xs font-semibold text-muted">Type<select className="input mt-1" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option><option value="photo">Photo</option><option value="booth">Booth</option><option value="collage">Collage</option><option value="scrapbook">Scrapbook</option></select></label>
        <label className="text-xs font-semibold text-muted">Sort<select className="input mt-1" value={sort} onChange={(e) => setSort(e.target.value as 'updated' | 'created')}><option value="updated">Last modified</option><option value="created">Date created</option></select></label>
        <div className="flex gap-1"><button className="btn-soft !p-2.5" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} /></button><button className="btn-soft !p-2.5" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} /></button></div>
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {loading ? <p className="mt-8 text-center text-muted" role="status">Loading your creations…</p> : shown.length === 0 ? (
        <div className="card mt-8 text-center"><p className="font-display text-2xl">{rows.length ? 'Nothing matches' : 'Nothing here yet'}</p><p className="mt-1 text-sm text-muted">{rows.length ? 'Try a different search or filter.' : 'Create something in the studio, then press “Save in browser” or “Save to account”.'}</p>{!rows.length && <Link className="btn-primary mt-4" href="/studio">Start creating</Link>}</div>
      ) : (
        <ul className={view === 'grid' ? 'mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4' : 'mt-6 space-y-2'}>
          {shown.map((r) => (
            <li key={r.key} className={`card ${view === 'list' ? 'flex items-center gap-4 !p-3' : '!p-3'}`}>
              <Link href={hrefFor(r)} className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-soft ${view === 'list' ? 'h-16 w-16' : 'mb-2 aspect-[4/5] w-full'}`} aria-label={`Open ${r.name}`}>{r.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.thumb} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl" aria-hidden>🌸</span>}</Link>
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.name}</p><p className="flex items-center gap-1 text-xs capitalize text-muted">{r.where === 'cloud' ? <Cloud size={12} /> : <HardDrive size={12} />}{r.type} · {new Date(r.updated).toLocaleDateString()}</p></div>
              <div className="mt-2 flex gap-1"><button className="btn-ghost !p-1.5" aria-label={`Rename ${r.name}`} onClick={() => rename(r)}><Pencil size={14} /></button><button className="btn-ghost !p-1.5" aria-label={`Duplicate ${r.name}`} onClick={() => dup(r)}><Copy size={14} /></button><button className="btn-ghost !p-1.5" aria-label={`Delete ${r.name}`} onClick={() => del(r)}><Trash2 size={14} /></button></div>
            </li>))}
        </ul>)}
    </div>
  );
}
