/**
 * Shared helper for surfacing a backend QUOTA_EXCEEDED error as a
 * sonner toast with an inline 'Upgrade' action linking to the
 * Stripe checkout flow.
 *
 * Callers wrap their backend calls and route caught errors through
 * here:
 *
 *     try {
 *       await createProject(wsId, input);
 *     } catch (e) {
 *       if (handleQuotaError(e, wsId)) return;
 *       toast.error(e instanceof Error ? e.message : 'failed');
 *     }
 *
 * Returns true when the error was handled (a quota toast was shown),
 * false otherwise — letting the caller fall through to its existing
 * generic-error path.
 */
import { toast } from 'sonner';

import { BackendError } from './backend/client';

const QUOTA_LABELS: Record<string, string> = {
  membersPerWorkspace: '멤버 수',
  projectsPerWorkspace: '프로젝트 수',
  sheetsPerProject: '시트 수',
  rowsPerSheet: '행 수',
  cellsPerProject: '셀 수',
  documentsPerProject: '문서 수',
};

export function handleQuotaError(err: unknown, workspaceId?: string): boolean {
  if (!(err instanceof BackendError) || !err.isQuotaExceeded) return false;
  const info = err.quotaInfo();
  const label = info?.key
    ? (QUOTA_LABELS[info.key] ?? info.key)
    : '한도';
  const detail = info
    ? `${label} 한도(${info.limit})에 도달했습니다 — 현재 ${info.current}, 플랜 ${info.plan}.`
    : err.message;
  toast.error(detail, {
    duration: 8000,
    action: workspaceId
      ? {
          label: '플랜 업그레이드',
          onClick: () => {
            void startCheckout(workspaceId).catch(() => {
              window.location.href = '/pricing';
            });
          },
        }
      : { label: '요금제 보기', onClick: () => { window.location.href = '/pricing'; } },
  });
  return true;
}

/**
 * Kicks off the Stripe checkout for a PRO upgrade on this workspace.
 * Backend mints a session URL; we redirect the browser to it. Errors
 * fall back to the public /pricing page so the user still has a way
 * forward.
 */
async function startCheckout(workspaceId: string): Promise<void> {
  const res = await fetch(`/api/v1/workspaces/${workspaceId}/billing/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'PRO' }),
  });
  if (!res.ok) throw new Error(`checkout failed (${res.status})`);
  const data = (await res.json()) as { url?: string };
  if (data.url) {
    window.location.href = data.url;
  } else {
    window.location.href = '/pricing';
  }
}
