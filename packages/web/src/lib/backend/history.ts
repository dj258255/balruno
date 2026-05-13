import { backendBaseUrl, request } from './client';

/**
 * One row of {@code cell_history} as returned by GET
 * /api/v1/projects/:id/sheets/:sid/rows/:rid/history (ADR 0038).
 *
 * The set of {@code action} codes mirrors sync wire ops:
 *   cell.update / cell.style.update / sheet.metadata.update /
 *   row.add / row.delete / row.move /
 *   column.add / column.update / column.delete
 *
 * Frontend resolves a friendly per-action label via i18n and
 * unpacks {@code payload} to render before/after deltas, the row
 * body that was inserted, etc.
 */
export interface HistoryEntry {
  id: string;
  projectId: string;
  sheetId: string;
  /** Null for column-level / sheet-level events. */
  rowId: string | null;
  /** Null for row-level / sheet-level events. */
  columnId: string | null;
  /** Null when the event was system-driven. */
  actorUserId: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface HistoryListOptions {
  /** Max entries; backend caps at 500. Defaults to 100 when omitted. */
  limit?: number;
}

/**
 * Newest-first activity for a single row inside a sheet. Backend
 * applies the workspace plan's history retention cutoff
 * (historyRetentionDays) before returning, so older rows aren't
 * exposed even if the cleanup scheduler hasn't deleted them yet.
 */
export function fetchRowHistory(
  projectId: string,
  sheetId: string,
  rowId: string,
  options: HistoryListOptions = {},
): Promise<HistoryEntry[]> {
  const params = qs(options);
  const path = params
    ? `/api/v1/projects/${projectId}/sheets/${sheetId}/rows/${rowId}/history?${params}`
    : `/api/v1/projects/${projectId}/sheets/${sheetId}/rows/${rowId}/history`;
  return request<HistoryEntry[]>(path);
}

/** Sheet-wide newest-first activity (column.* + row.* + sheet.*). */
export function fetchSheetHistory(
  projectId: string,
  sheetId: string,
  options: HistoryListOptions = {},
): Promise<HistoryEntry[]> {
  const params = qs(options);
  const path = params
    ? `/api/v1/projects/${projectId}/sheets/${sheetId}/history?${params}`
    : `/api/v1/projects/${projectId}/sheets/${sheetId}/history`;
  return request<HistoryEntry[]>(path);
}

function qs(options: HistoryListOptions): string {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  return params.toString();
}

/**
 * Page-history snapshot metadata for a doc body (ADR 0038 stage C).
 * The yjs binary state lives behind a separate endpoint so the list
 * stays light. Frontend pulls one snapshot's bytes only when the
 * user actually picks a moment to preview / restore.
 */
export interface DocSnapshot {
  id: string;
  docId: string;
  projectId: string;
  actorUserId: string | null;
  /** First N chars of plain-text body — preview shown in the list. */
  summary: string | null;
  createdAt: string;
}

export function fetchDocSnapshots(
  docId: string,
  options: HistoryListOptions = {},
): Promise<DocSnapshot[]> {
  const params = qs(options);
  const path = params
    ? `/api/v1/docs/${docId}/snapshots?${params}`
    : `/api/v1/docs/${docId}/snapshots`;
  return request<DocSnapshot[]>(path);
}

/**
 * Fetches the raw yjs state bytes for a snapshot. The caller feeds
 * them into Y.applyUpdate on a fresh Y.Doc to render the historical
 * version (read-only preview).
 *
 * Must prefix the backend base URL — a bare `/api/v1/...` resolves
 * against the Vercel frontend origin and 404s. The other history
 * helpers all go through `request()` for the same reason; this one
 * stays on raw `fetch` because the response body is binary
 * (ArrayBuffer) and `request()` JSON-parses by default.
 */
export async function downloadDocSnapshotState(
  docId: string,
  snapshotId: string,
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${backendBaseUrl()}/api/v1/docs/${docId}/snapshots/${snapshotId}/state`,
    { credentials: 'include' },
  );
  if (!res.ok) {
    throw new Error(`Snapshot fetch failed (${res.status})`);
  }
  return res.arrayBuffer();
}
