import { request } from './client';

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
