'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, FlipHorizontal, RefreshCw, Timer, X, Check, CameraOff } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera.ts';
import { FILTER_PRESETS } from '../../features/filters/presets.ts';
import { handoffPut } from '../../lib/blobs.ts';

export default function CameraPage() {
  const cam = useCamera(); const { state, dispatch, videoRef } = cam; const router = useRouter();
  const [shot, setShot] = useState<Blob | null>(null); const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(null); const [flash, setFlash] = useState(false); const [err, setErr] = useState<string | null>(null);
  const css = preset ? FILTER_PRESETS.find((p) => p.id === preset)?.thumbCss : undefined;

  useEffect(() => {
    if (state.status !== 'capturing') return;
    (async () => { try { const b = await cam.grab(); setFlash(true); setTimeout(() => setFlash(false), 350); const u = URL.createObjectURL(b); setShot(b); setShotUrl(u); dispatch({ type: 'CAPTURED', url: u }); } catch (e) { setErr((e as Error).message); dispatch({ type: 'FAILED', code: 'unknown' }); } })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);
  useEffect(() => () => { if (shotUrl) URL.revokeObjectURL(shotUrl); }, [shotUrl]);

  const edit = async () => { if (!shot) return; await handoffPut([shot]); cam.stop(); router.push(`/studio?from=camera${preset ? `&filter=${preset}` : ''}`); };
  const retake = () => { dispatch({ type: 'RETAKE' }); setShot(null); setShotUrl(null); };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-display text-3xl">Camera</h1>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="relative overflow-hidden rounded-xl3 bg-ink/90 shadow-soft" style={{ aspectRatio: '4 / 3' }}>
          <video ref={videoRef} playsInline muted aria-label="Live camera preview" className={`h-full w-full object-cover ${state.mirror ? '-scale-x-100' : ''} ${state.status === 'reviewing' ? 'invisible' : ''}`} style={{ filter: css }} />
          {state.status === 'reviewing' && shotUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={shotUrl} alt="Captured photo" className="absolute inset-0 h-full w-full object-cover" />}
          {cam.active && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Camera on</span>}
          {state.status === 'countdown' && <div aria-live="assertive" className="pop absolute inset-0 flex items-center justify-center text-9xl font-bold text-white drop-shadow-lg">{state.countdown}</div>}
          {flash && <div className="flash absolute inset-0 bg-white" aria-hidden />}
          {(state.status === 'idle' || state.status === 'requesting' || state.status === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-soft p-6 text-center text-ink">
              {state.status === 'error' ? <><CameraOff size={40} className="text-rose" /><p role="alert" className="max-w-sm text-sm">{err ?? state.error?.message}</p><button className="btn-primary" onClick={() => { setErr(null); void cam.start(); }}><RefreshCw size={16} /> Try again</button></>
                : <><Camera size={40} className="text-rose" /><p className="max-w-xs text-sm">BlushCam only asks for your camera when you press the button. Video never leaves your device.</p><button className="btn-primary" disabled={state.status === 'requesting'} onClick={() => void cam.start()}>{state.status === 'requesting' ? 'Waiting for permission…' : 'Allow camera & start'}</button></>}
            </div>)}
        </div>
        <div className="space-y-4">
          {state.status === 'reviewing' ? (
            <div className="card space-y-2"><button className="btn-primary w-full" onClick={edit}><Check size={16} /> Edit this photo</button><button className="btn-soft w-full" onClick={retake}>Retake</button></div>
          ) : (
            <>
              <button className="btn-primary w-full !py-4 text-base" disabled={state.status !== 'ready'} onClick={() => dispatch({ type: 'SHUTTER' })}><Camera size={20} /> {state.timer ? `Capture in ${state.timer}s` : 'Capture'}</button>
              {state.status === 'countdown' && <button className="btn-ghost w-full" onClick={() => dispatch({ type: 'CANCEL' })}><X size={16} /> Cancel</button>}
              <div className="card space-y-3">
                <div><span className="label"><Timer size={12} className="mr-1 inline" />Timer</span><div className="flex gap-1.5">{([0, 3, 5, 10] as const).map((t) => <button key={t} className="chip" aria-pressed={state.timer === t} onClick={() => dispatch({ type: 'SET_TIMER', timer: t })}>{t ? `${t}s` : 'Off'}</button>)}</div></div>
                <button className="chip" aria-pressed={state.mirror} onClick={() => dispatch({ type: 'TOGGLE_MIRROR' })}><FlipHorizontal size={12} className="mr-1" /> Mirror preview</button>
                <div><span className="label">Camera</span><div className="flex gap-1.5">{(['user', 'environment'] as const).map((f) => <button key={f} className="chip" aria-pressed={state.facing === f} onClick={() => { dispatch({ type: 'SET_FACING', facing: f }); if (cam.active) void cam.start({ facing: f, deviceId: null }); }}>{f === 'user' ? 'Front' : 'Rear'}</button>)}</div></div>
                {cam.devices.length > 1 && <div><label className="label" htmlFor="dev">Device</label><select id="dev" className="input" value={state.deviceId ?? ''} onChange={(e) => { dispatch({ type: 'SET_DEVICE', deviceId: e.target.value || null }); void cam.start({ deviceId: e.target.value || null }); }}><option value="">Automatic</option>{cam.devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></div>}
                <div><label className="label" htmlFor="res">Resolution</label><select id="res" className="input" value={state.resolution} onChange={(e) => { const r = e.target.value as '720p' | '1080p' | 'max'; dispatch({ type: 'SET_RESOLUTION', resolution: r }); if (cam.active) void cam.start({ resolution: r }); }}><option value="720p">720p</option><option value="1080p">1080p</option><option value="max">Maximum supported</option></select>{cam.info && <p className="mt-1 text-xs text-muted">Actual: {cam.info.width}×{cam.info.height}</p>}</div>
                <div><label className="label" htmlFor="flt">Live filter preview</label><select id="flt" className="input" value={preset ?? ''} onChange={(e) => setPreset(e.target.value || null)}><option value="">None</option>{FILTER_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}</select><p className="mt-1 text-xs text-muted">Preview is approximate; the exact filter is applied in the editor.</p></div>
              </div>
              {cam.active && <button className="btn-ghost w-full" onClick={cam.stop}>Turn camera off</button>}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
