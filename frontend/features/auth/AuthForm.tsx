'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, setCsrf } from '../../lib/api.ts';
import type { User } from '../../lib/api.ts';
import { safeNext, validateLogin, validateRegister } from '../../lib/validation.ts';
import type { FieldErrors } from '../../lib/validation.ts';

type Mode = 'login' | 'register';
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter(); const next = safeNext(useSearchParams().get('next'));
  const [f, setF] = useState({ email: '', password: '', confirm: '', displayName: '' }); const [errs, setErrs] = useState<FieldErrors>({}); const [formErr, setFormErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f, label: string, type = 'text', auto?: string) => (
    <div><label className="label" htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} className="input" type={type} autoComplete={auto} value={f[k]} aria-invalid={!!errs[k]} aria-describedby={errs[k] ? `e-${k}` : undefined} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {errs[k] && <p id={`e-${k}`} role="alert" className="mt-1 text-xs text-red-700">{errs[k]}</p>}</div>);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr(null);
    const v = mode === 'login' ? validateLogin(f) : validateRegister(f); setErrs(v); if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const r = await api<{ user: User; csrfToken: string }>(`/auth/${mode}`, { json: { email: f.email.trim(), password: f.password, displayName: f.displayName.trim() } });
      setCsrf(r.csrfToken); router.replace(next); router.refresh();
    } catch (x) { if (x instanceof ApiError) { setErrs(x.fields ?? {}); setFormErr(x.message); } else setFormErr('Something went wrong.'); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} noValidate className="card space-y-4" aria-labelledby="auth-h">
        <h1 id="auth-h" className="font-display text-3xl">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        {mode === 'register' && field('displayName', 'Display name (optional)', 'text', 'nickname')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', mode === 'login' ? 'current-password' : 'new-password')}
        {mode === 'register' && field('confirm', 'Confirm password', 'password', 'new-password')}
        {formErr && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formErr}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p className="text-center text-sm text-muted">{mode === 'login' ? <>New here? <Link className="font-semibold text-rose" href="/register">Create an account</Link> · <Link className="font-semibold text-rose" href="/forgot-password">Forgot password?</Link></> : <>Have an account? <Link className="font-semibold text-rose" href="/login">Sign in</Link></>}</p>
        <p className="text-center text-xs text-muted">Camera, filters, collages and scrapbooks work without an account.</p>
      </form>
    </main>
  );
}
