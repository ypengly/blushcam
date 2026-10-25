export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'countdown' | 'capturing' | 'reviewing' | 'error';
export type CameraErrorCode = 'denied' | 'no-device' | 'in-use' | 'unsupported' | 'insecure' | 'constraints' | 'unknown';

export interface CameraState {
  status: CameraStatus;
  facing: 'user' | 'environment';
  deviceId: string | null;
  mirror: boolean;
  timer: 0 | 3 | 5 | 10;
  countdown: number | null;
  resolution: '720p' | '1080p' | 'max';
  error: { code: CameraErrorCode; message: string } | null;
  captured: string | null; // object URL / data URL of the shot under review
}

export type CameraEvent =
  | { type: 'REQUEST' }
  | { type: 'GRANTED' }
  | { type: 'FAILED'; code: CameraErrorCode }
  | { type: 'STOP' }
  | { type: 'SET_FACING'; facing: 'user' | 'environment' }
  | { type: 'SET_DEVICE'; deviceId: string | null }
  | { type: 'SET_TIMER'; timer: 0 | 3 | 5 | 10 }
  | { type: 'SET_RESOLUTION'; resolution: CameraState['resolution'] }
  | { type: 'TOGGLE_MIRROR' }
  | { type: 'SHUTTER' }
  | { type: 'TICK' }
  | { type: 'CANCEL' }
  | { type: 'CAPTURED'; url: string }
  | { type: 'RETAKE' }
  | { type: 'CONFIRM' }
  | { type: 'DEVICE_LOST' };

export const initialCameraState: CameraState = {
  status: 'idle', facing: 'user', deviceId: null, mirror: true, timer: 0, countdown: null, resolution: '1080p', error: null, captured: null,
};

export const CAMERA_ERRORS: Record<CameraErrorCode, string> = {
  denied: 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.',
  'no-device': 'No camera was found on this device.',
  'in-use': 'The camera is busy or unavailable. Close other apps that may be using it and try again.',
  unsupported: 'This browser does not support camera access. Try a recent version of Chrome, Edge, Firefox or Safari.',
  insecure: 'Camera access requires a secure (HTTPS) connection.',
  constraints: 'The selected camera or resolution isn’t supported. Try a lower resolution or another camera.',
  unknown: 'Something went wrong while starting the camera.',
};

export function mapMediaError(err: unknown): CameraErrorCode {
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': return 'no-device';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'in-use';
    case 'OverconstrainedError': case 'ConstraintNotSatisfiedError': return 'constraints';
    default: return 'unknown';
  }
}

/** Legal transitions only; everything else returns the same state object. */
export function cameraReducer(s: CameraState, e: CameraEvent): CameraState {
  switch (e.type) {
    case 'REQUEST':
      if (s.status === 'idle' || s.status === 'error' || s.status === 'ready') return { ...s, status: 'requesting', error: null };
      return s;
    case 'GRANTED': return s.status === 'requesting' ? { ...s, status: 'ready' } : s;
    case 'FAILED': return { ...s, status: 'error', countdown: null, error: { code: e.code, message: CAMERA_ERRORS[e.code] } };
    case 'STOP': return { ...s, status: 'idle', countdown: null, captured: null, error: null };
    case 'DEVICE_LOST': return s.status === 'idle' ? s : { ...s, status: 'error', countdown: null, error: { code: 'no-device', message: 'The camera was disconnected.' } };
    case 'SET_FACING': return { ...s, facing: e.facing, deviceId: null };
    case 'SET_DEVICE': return { ...s, deviceId: e.deviceId };
    case 'SET_TIMER': return { ...s, timer: e.timer };
    case 'SET_RESOLUTION': return { ...s, resolution: e.resolution };
    case 'TOGGLE_MIRROR': return { ...s, mirror: !s.mirror };
    case 'SHUTTER':
      if (s.status !== 'ready') return s;
      return s.timer > 0 ? { ...s, status: 'countdown', countdown: s.timer } : { ...s, status: 'capturing', countdown: null };
    case 'TICK':
      if (s.status !== 'countdown' || s.countdown === null) return s;
      return s.countdown <= 1 ? { ...s, status: 'capturing', countdown: null } : { ...s, countdown: s.countdown - 1 };
    case 'CANCEL': return s.status === 'countdown' ? { ...s, status: 'ready', countdown: null } : s;
    case 'CAPTURED': return s.status === 'capturing' ? { ...s, status: 'reviewing', captured: e.url } : s;
    case 'RETAKE': return s.status === 'reviewing' ? { ...s, status: 'ready', captured: null } : s;
    case 'CONFIRM': return s.status === 'reviewing' ? { ...s, status: 'ready', captured: null } : s;
    default: return s;
  }
}

export function videoConstraints(s: Pick<CameraState, 'facing' | 'deviceId' | 'resolution'>): MediaTrackConstraints {
  const size = s.resolution === '720p' ? { width: { ideal: 1280 }, height: { ideal: 720 } }
    : s.resolution === '1080p' ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
    : { width: { ideal: 4096 }, height: { ideal: 2160 } };
  return s.deviceId ? { deviceId: { exact: s.deviceId }, ...size } : { facingMode: { ideal: s.facing }, ...size };
}
