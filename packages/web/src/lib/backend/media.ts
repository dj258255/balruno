/**
 * Resolve a stored avatar URL into something the browser can fetch.
 *
 * The backend stores either form on {@code users.avatar_url}:
 *   - A relative {@code /media/avatars/...} path served by the same
 *     backend that owns the upload endpoint. The frontend lives on
 *     a different origin (Vercel apex) than the API, so the browser
 *     would resolve this against the wrong host without help.
 *   - An absolute OAuth-provider URL (e.g.
 *     {@code https://avatars.githubusercontent.com/...}) populated
 *     by the login flow on first OAuth landing.
 *
 * This helper prepends {@link backendBaseUrl} only for the relative
 * {@code /media/} form, leaving absolute URLs untouched. Using it
 * everywhere a `<img>` renders avatarUrl avoids the silent
 * cross-origin 404 the route-fix uncovered.
 */

import { backendBaseUrl } from './client';

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/media/')) return `${backendBaseUrl()}${url}`;
  // Anything else (data:, blob:, relative non-/media) passes through
  // — those are caller-supplied previews where the resolution rule
  // shouldn't apply.
  return url;
}
