'use client';
/** Browser-local storage: blob registry for photos in the editor + IndexedDB for guest projects and camera→editor handoff. */
const registry = new Map<string, Blob>();
export const registerBlob = (key: string, blob: Blob) => { registry.set(key, blob); };
export const getBlob = (key: string) => registry.get(key);
export const allBlobs = () => registry;

const DB = 'blushcam'; const VER = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('projects', { keyPath: 'id' }); db.createObjectStore('blobs'); db.createObjectStore('handoff'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const req = fn(t.objectStore(store));
    t.oncomplete = () => { db.close(); res(req ? (req as IDBRequest<T>).result : undefined); };
    t.onerror = () => { db.close(); rej(t.error); }; t.onabort = () => { db.close(); rej(t.error); };
  });
}

export interface LocalProject { id: string; name: string; type: string; docs: unknown[]; updatedAt: number; createdAt: number; thumb?: string; blobKeys: string[] }

export const localPut = (p: LocalProject) => tx('projects', 'readwrite', (s) => s.put(p));
export const localGet = (id: string) => tx<LocalProject>('projects', 'readonly', (s) => s.get(id));
export const localList = () => tx<LocalProject[]>('projects', 'readonly', (s) => s.getAll()).then((x) => x ?? []);
export async function localDelete(id: string) {
  const p = await localGet(id);
  await tx('projects', 'readwrite', (s) => s.delete(id));
  if (p) for (const k of p.blobKeys) await tx('blobs', 'readwrite', (s) => s.delete(`${id}:${k}`));
}
export const blobPut = (projectId: string, key: string, blob: Blob) => tx('blobs', 'readwrite', (s) => s.put(blob, `${projectId}:${key}`));
export const blobGet = (projectId: string, key: string) => tx<Blob>('blobs', 'readonly', (s) => s.get(`${projectId}:${key}`));

export const handoffPut = (blobs: Blob[]) => tx('handoff', 'readwrite', (s) => s.put(blobs, 'photos'));
export async function handoffTake(): Promise<Blob[]> {
  const v = await tx<Blob[]>('handoff', 'readonly', (s) => s.get('photos'));
  if (v) await tx('handoff', 'readwrite', (s) => s.delete('photos'));
  return v ?? [];
}
