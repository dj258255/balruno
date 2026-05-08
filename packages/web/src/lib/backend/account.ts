/**
 * GDPR self-service: account export + deletion.
 */

import { request } from './client';

export function exportMyData(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/api/v1/me/export-data');
}

export async function deleteMyAccount(): Promise<void> {
  await request<void>('/api/v1/me/account?confirm=DELETE', { method: 'DELETE' });
}

export async function downloadDataExport(): Promise<void> {
  const data = await exportMyData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `balruno-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
