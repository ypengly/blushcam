export interface FieldErrors { [field: string]: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(v: string): string | null {
  const e = v.trim(); if (!e) return 'Enter your email.'; if (e.length > 254 || !EMAIL.test(e)) return 'Enter a valid email address.'; return null;
}
export function validatePassword(v: string): string | null {
  if (v.length < 10) return 'Use at least 10 characters.'; if (v.length > 128) return 'Use at most 128 characters.';
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return 'Include at least one letter and one number.'; return null;
}
export function validateRegister(f: { email: string; password: string; confirm: string; displayName?: string }): FieldErrors {
  const e: FieldErrors = {}; const em = validateEmail(f.email); if (em) e.email = em;
  const pw = validatePassword(f.password); if (pw) e.password = pw;
  if (!pw && f.password !== f.confirm) e.confirm = 'Passwords don’t match.';
  if ((f.displayName ?? '').length > 60) e.displayName = 'Keep your name under 60 characters.'; return e;
}
export function validateLogin(f: { email: string; password: string }): FieldErrors {
  const e: FieldErrors = {}; const em = validateEmail(f.email); if (em) e.email = em; if (!f.password) e.password = 'Enter your password.'; return e;
}
/** Only same-site relative redirects are allowed after login (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return fallback; return next;
}
