'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { cameraReducer, initialCameraState, mapMediaError, videoConstraints } from '../features/camera/machine.ts';

/** Real getUserMedia camera. Permission is requested only from start(), which callers wire to a user action. */
export function useCamera() {
  const [state, dispatch] = useReducer(cameraReducer, initialCameraState);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [info, setInfo] = useState<{ width: number; height: number } | null>(null);
  const stateRef = useRef(state); stateRef.current = state;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const refreshDevices = useCallback(async () => {
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')); } catch { /* ignore */ }
  }, []);

  const start = useCallback(async (override?: Partial<typeof state>) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: 'REQUEST' }); dispatch({ type: 'FAILED', code: window.isSecureContext ? 'unsupported' : 'insecure' }); return;
    }
    if (!window.isSecureContext) { dispatch({ type: 'REQUEST' }); dispatch({ type: 'FAILED', code: 'insecure' }); return; }
    dispatch({ type: 'REQUEST' });
    stopTracks();
    try {
      const s = { ...stateRef.current, ...override };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(s), audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play().catch(() => undefined); }
      const settings = stream.getVideoTracks()[0]?.getSettings();
      if (settings?.width && settings?.height) setInfo({ width: settings.width, height: settings.height });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => dispatch({ type: 'DEVICE_LOST' }));
      dispatch({ type: 'GRANTED' });
      await refreshDevices(); // labels are only available after permission
    } catch (e) { dispatch({ type: 'FAILED', code: mapMediaError(e) }); }
  }, [refreshDevices, stopTracks]);

  const stop = useCallback(() => { stopTracks(); dispatch({ type: 'STOP' }); }, [stopTracks]);

  // Stop camera on unmount and when the tab is hidden for a long time? -> always on unmount.
  useEffect(() => () => stopTracks(), [stopTracks]);

  // Recover after devices change (plug/unplug).
  useEffect(() => {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.addEventListener) return;
    const onChange = () => { void refreshDevices(); if (stateRef.current.status === 'error' && stateRef.current.error?.code === 'no-device') void start(); };
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, [refreshDevices, start]);

  // Countdown ticking
  useEffect(() => {
    if (state.status !== 'countdown') return;
    const t = setTimeout(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearTimeout(t);
  }, [state.status, state.countdown]);

  /** Grab the current frame at native resolution as a Blob (mirrored if the preview is mirrored, so the photo matches what the user saw). */
  const grab = useCallback(async (): Promise<Blob> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) throw new Error('Camera isn’t ready yet.');
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    if (stateRef.current.mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the captured frame.'))), 'image/jpeg', 0.95));
  }, []);

  const active = state.status === 'ready' || state.status === 'countdown' || state.status === 'capturing' || state.status === 'reviewing';
  return { state, dispatch, videoRef, devices, info, start, stop, grab, active };
}
