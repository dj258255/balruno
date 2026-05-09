/**
 * Multipart upload helpers. The shared {@link request} helper assumes
 * JSON body + Content-Type, so multipart calls bypass it and talk to
 * fetch directly — Content-Type with the boundary is set by the
 * browser when {@code body} is a {@code FormData}.
 *
 * Returned URL is what callers should store on the user record (e.g.
 * users.avatar_url). It's a relative path (`/media/...`) so the
 * existing nginx routing on prod + Next.js dev proxy serves it from
 * the API host.
 */

import { backendBaseUrl, BackendError } from './client';

interface UploadResult {
  url: string;
}

/**
 * POST /api/v1/uploads/avatar — authenticated multipart upload.
 * Server validates size (≤2MB) + content-type (png/jpeg/webp/gif).
 */
export async function uploadAvatar(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`${backendBaseUrl()}/api/v1/uploads/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      // ignore — fall through with body = null
    }
    throw new BackendError(res.status, body as { detail?: string } | null, res.statusText);
  }
  return (await res.json()) as UploadResult;
}
