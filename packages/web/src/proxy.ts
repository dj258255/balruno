/**
 * Login guard — Linear-style "server is canonical" mode.
 *
 * Redirects unauthenticated visits to /login when the backend is wired
 * up (NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BALRUNO_API_URL set). Without
 * a backend the app still works offline so the proxy is a no-op.
 *
 * Auth signal: the backend's httpOnly `balruno_session` cookie (a JWT)
 * is sent by the browser to *.balruno.com automatically. The proxy
 * reads its presence — never the value — to decide whether to allow the
 * route. Real authn / authz happens at the backend on each /api/v1/**
 * request.
 *
 * File convention: Next.js 16 deprecated the `middleware.ts` filename
 * in favour of `proxy.ts` (same matcher syntax, named export renamed).
 * The proxy runtime is `nodejs` — there is no edge-runtime variant.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/i',         // /i/{token} invite links
  '/terms',
  '/privacy',
];

const STATIC_PREFIXES = ['/_next', '/favicon', '/icon', '/api', '/manifest'];

// /w/[slug] is a private route — gated by the default (auth-required) branch below.
// No additions needed here; this comment is a marker so future audits don't widen
// the public list by mistake.

function isPublicPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function backendConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_BALRUNO_API_URL ?? process.env.NEXT_PUBLIC_API_URL,
  );
}

export function proxy(req: NextRequest) {
  if (!backendConfigured()) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const sessionCookie = req.cookies.get('balruno_session')?.value;
  if (sessionCookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
