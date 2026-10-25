'use client';
/** Thin same-origin API client. Mutating requests carry the CSRF token returned by login/me. */
let csrf = '';
export function setCsrf(t: string) { csrf = t; }
export function getCsrf() { return csrf; }

export class ApiError extends Error {
  status: number; code: string; fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) { super(message); this.status = status; this.code = code; this.fields = fields; }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; form?: FormData } = {}): Promise<T> {
  const method = (init.method ?? (init.json !== undefined || init.form ? 'POST' : 'GET')).toUpperCase();
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && csrf) headers.set('X-CSRF-Token', csrf);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, method, headers, credentials: 'same-origin', body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : init.body) });
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'error', body?.error?.message ?? `Request failed (${res.status})`, body?.error?.fields);
  return body as T;
}

export interface User { id: string; email: string; displayName: string }
export interface ProjectSummary { id: string; name: string; projectType: 'photo' | 'booth' | 'collage' | 'scrapbook'; createdAt: string; updatedAt: string; previewUrl?: string | null; collectionId?: string | null }
