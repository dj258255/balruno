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
  return postMultipart('/api/v1/uploads/avatar', fd);
}

export interface AttachmentRef {
  /** Which content kind the attachment is being inserted into. */
  kind: 'comment' | 'doc' | 'cell';
  /** UUID of the owning comment / doc / cell. Tier 2b orphan
   *  cleanup keys on this — when the content is removed, the
   *  attachment ref drops and the blob frees if no other refs remain. */
  id: string;
}

/**
 * POST /api/v1/uploads/attachment — authenticated project-scoped
 * upload. Server enforces 50MB cap + mime allowlist + magic-byte
 * sniff + workspace storage quota in the same request.
 *
 * The optional ref records who's referencing the upload (Tier 2b
 * orphan tracking). Without it the upload still succeeds but only
 * the project-cascade catches eventual cleanup.
 */
export async function uploadAttachment(
  projectId: string,
  file: File,
  ref?: AttachmentRef,
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('projectId', projectId);
  if (ref) {
    fd.append('refKind', ref.kind);
    fd.append('refId', ref.id);
  }
  fd.append('file', file);
  return postMultipart('/api/v1/uploads/attachment', fd);
}

async function postMultipart(path: string, fd: FormData): Promise<UploadResult> {
  const res = await fetch(`${backendBaseUrl()}${path}`, {
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
      // fall through with body = null
    }
    throw new BackendError(res.status, body as { detail?: string } | null, res.statusText);
  }
  return (await res.json()) as UploadResult;
}
