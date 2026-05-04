/**
 * Login guard — Linear-style "server is canonical" mode.
 *
 * If the backend is configured (NEXT_PUBLIC_API_URL is set) we redirect
 * unauthenticated visits to /login. Public auth-related pages stay open.
 *
 * Detection: a non-empty `balruno-auth` cookie or LocalStorage value is
 * surfaced via the lightweight `auth-state` cookie that the client writes
 * on login (see authStore — written from a useEffect bridge in layout).
 *
 * If the backend is NOT configured (local-only dev, no NEXT_PUBLIC_API_URL),
 * the middleware is a no-op so the app still works offline.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
  '/terms',
  '/privacy',
];

const STATIC_PREFIXES = ['/_next', '/favicon', '/icon', '/api', '/manifest'];

function isPublicPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const authCookie = req.cookies.get('balruno-authed')?.value;
  if (authCookie === '1') return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
