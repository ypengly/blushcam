'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api.ts';
import { useUser } from '../../hooks/useUser.ts';

interface Prefs { theme: 'light' | 'dark'; mirrorPreview: boolean; defaultExport: 'png' | 'jpeg' | 'webp'; aiConsent: boolean }
export default function Settings() {
  const { user } = useUser(); const router = useRouter();
  const [name, setName] = useState(''); const [prefs, setPrefs] = useState<Prefs | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (user) setName(user.displayName); }, [user]);
  useEffect(() => { api<Prefs>('/me/preferences').then(setPrefs).catch(() => setErr('Could not load preferences.')); }, []);
  const save = async () => { setMsg(null); setErr(null); try { await api('/me', { method: 'PATCH', json: { displayName: name } }); if (prefs) await api('/me/preferences', { method: 'PUT', json: prefs }); setMsg('Saved.'); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Save failed.'); } };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); router.replace('/'); router.refresh(); };
  const del = async () => { const pw = window.prompt('Deleting your account permanently removes your projects and photos. Type your password to confirm.'); if (!pw) return; try { await api('/me', { method: 'DELETE', json: { password: pw } }); router.replace('/'); router.refresh(); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not delete the account.'); } };
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8"><h1 className="font-display text-3xl">Settings</h1>
      <section className="card space-y-4" aria-labelledby="acct"><h2 id="acct" className="font-bold">Account</h2><p className="text-sm text-muted">{user?.email}</p>
        <div><label className="label" htmlFor="dn">Display name</label><input id="dn" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></div></section>
      {prefs && <section className="card space-y-3" aria-labelledby="pref"><h2 id="pref" className="font-bold">Preferences</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.mirrorPreview} onChange={(e) => setPrefs({ ...prefs, mirrorPreview: e.target.checked })} /> Mirror camera preview by default</label>
        <div><span className="label">Default export format</span><div className="flex gap-2">{(['png', 'jpeg', 'webp'] as const).map((f) => <button key={f} className="chip" aria-pressed={prefs.defaultExport === f} onClick={() => setPrefs({ ...prefs, defaultExport: f })}>{f.toUpperCase()}</button>)}</div></div>
        <div><span className="label">Theme</span><div className="flex gap-2">{(['light', 'dark'] as const).map((t) => <button key={t} className="chip" aria-pressed={prefs.theme === t} onClick={() => { setPrefs({ ...prefs, theme: t }); document.documentElement.dataset.theme = t; try { localStorage.setItem('blushcam-theme', t); } catch { /* ignore */ } }}>{t}</button>)}</div></div></section>}
      <section className="card space-y-2" aria-labelledby="priv"><h2 id="priv" className="font-bold">Privacy</h2><p className="text-sm text-muted">AI tools always ask for consent per request. Nothing is uploaded unless you choose “Save to account” or run an AI tool.</p></section>
      {msg && <p role="status" className="rounded-xl bg-mint p-3 text-sm">{msg}</p>}{err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={save}>Save changes</button><button className="btn-soft" onClick={logout}>Sign out</button><button className="btn-ghost text-red-700" onClick={del}>Delete account…</button></div>
    </main>
  );
}
