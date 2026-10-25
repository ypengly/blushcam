import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API = process.env.API_INTERNAL_URL || 'http://localhost:8080';
const COOKIE = process.env.SESSION_COOKIE_NAME || 'blushcam_session';

/** Server-side gate for authenticated pages: the session is verified against the Go API, not just checked for presence. */
export async function middleware(req: NextRequest) {
  const login = new URL('/login', req.url);
  login.searchParams.set('next', req.nextUrl.pathname);
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.redirect(login);
  try {
    const r = await fetch(`${API}/api/v1/auth/me`, { headers: { cookie: `${COOKIE}=${token}` }, cache: 'no-store' });
    if (r.status === 200) return NextResponse.next();
    if (r.status === 401) { const res = NextResponse.redirect(login); res.cookies.delete(COOKIE); return res; }
  } catch { /* API unreachable → fail closed */ }
  return NextResponse.redirect(login);
}
export const config = { matcher: ['/dashboard/:path*', '/gallery/:path*', '/settings/:path*'] };
