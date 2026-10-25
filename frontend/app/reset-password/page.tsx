'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../lib/api.ts';
import { validatePassword } from '../../lib/validation.ts';

function Reset() {
  const token = useSearchParams().get('token') ?? ''; const [pw, setPw] = useState(''); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const v = validatePassword(pw); setErr(v); if (v) return;
    try { await api('/auth/reset-password', { json: { token, password: pw } }); setOk(true); } catch (x) { setErr(x instanceof ApiError ? x.message : 'Could not reset password.'); } };
  return <main className="mx-auto max-w-md px-4 py-12"><form onSubmit={submit} noValidate className="card space-y-4"><h1 className="font-display text-3xl">Choose a new password</h1>
    {ok ? <p role="status">Password updated. <Link className="font-semibold text-rose" href="/login">Sign in</Link></p> : <><div><label className="label" htmlFor="np">New password</label><input id="np" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />{err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}</div><button className="btn-primary w-full" disabled={!token}>Update password</button>{!token && <p className="text-xs text-muted">This link is missing its token.</p>}</>}</form></main>;
}
export default function Page() { return <Suspense><Reset /></Suspense>; }
