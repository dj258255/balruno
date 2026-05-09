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
 *
 * On success this fires {@link ATTACHMENT_UPLOADED_EVENT} on
 * {@code window} so the WorkspaceStorageBadge refreshes its quota
 * read-out without the caller having to remember.
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
  const result = await postMultipart('/api/v1/uploads/attachment', fd);
  announceAttachmentUploaded();
  return result;
}

/** Window event name dispatched after every successful attachment
 *  upload. WorkspaceStorageBadge listens to refresh its read-out;
 *  any future surface that wants live quota updates can subscribe. */
export const ATTACHMENT_UPLOADED_EVENT = 'balruno:attachment-uploaded';

function announceAttachmentUploaded(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ATTACHMENT_UPLOADED_EVENT));
}

/**
 * Translator surface — a subset of next-intl's useTranslations()
 * return shape. Typed loosely so this module doesn't pull in
 * next-intl as a hard dep (the helper is unit-testable with any
 * (key, params) → string function).
 */
export type UploadErrorTranslator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Shared error → toast-string mapping for upload failures.
 *
 * The 4 surfaces (avatar, doc inline image, comment inline image,
 * cell file column) all hit the same backend pipeline and surface
 * the same error codes. Centralising the mapping keeps the
 * messaging consistent and ensures a new server-side code (e.g.
 * a future MIME tightening) only needs to land here once.
 *
 * Localisation goes through the {@code uploadErrors.*} namespace —
 * the caller passes its {@code useTranslations()} result in so we
 * stay free of React + next-intl static deps inside this lib
 * module. The {@code kind} param picks the noun string to interpolate
 * (image / file / photo), and {@code maxLabel} the size shown on 413.
 */
export function humanizeUploadError(
  e: unknown,
  t: UploadErrorTranslator,
  opts: { kind: 'image' | 'file' | 'photo'; maxLabel: '2MB' | '50MB' },
): string {
  const kindNoun = t(`uploadErrors.kinds.${opts.kind}`);
  if (e instanceof BackendError) {
    if (e.code === 'attachmentBytes') {
      return t('uploadErrors.quotaFull');
    }
    if (e.status === 413) {
      return t('uploadErrors.tooLarge', { kind: kindNoun, maxLabel: opts.maxLabel });
    }
    if (e.status === 415) {
      return t('uploadErrors.unsupported', { kind: kindNoun });
    }
    return e.body?.detail ?? e.message ?? t('uploadErrors.failed', { kind: kindNoun });
  }
  return e instanceof Error ? e.message : t('uploadErrors.failed', { kind: kindNoun });
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
