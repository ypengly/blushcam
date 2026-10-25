'use client';
import { useState } from 'react';
import { api } from '../../lib/api.ts';
import { validateEmail } from '../../lib/validation.ts';

export default function Forgot() {
  const [email, setEmail] = useState(''); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const v = validateEmail(email); setErr(v); if (v) return; setBusy(true);
    try { const r = await api<{ message: string }>('/auth/forgot-password', { json: { email: email.trim() } }); setDone(r.message); } catch { setErr('Could not send the request. Try again shortly.'); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-md px-4 py-12"><form onSubmit={submit} noValidate className="card space-y-4"><h1 className="font-display text-3xl">Reset your password</h1>
      {done ? <p role="status" className="rounded-xl bg-mint p-3 text-sm">{done}</p> : <>
        <div><label className="label" htmlFor="fe">Email</label><input id="fe" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />{err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}</div>
        <button className="btn-primary w-full" disabled={busy}>Send reset link</button></>}
    </form></main>
  );
}
