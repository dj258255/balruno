'use client';

/**
 * Compact storage-usage indicator for the active workspace.
 *
 * - Pulls UserQuota.workspaces from /me/quota and picks the row that
 *   matches sidebarPrefs.activeWorkspaceId (Linear pattern — one
 *   active workspace at a time).
 * - Refreshes on the {@code ATTACHMENT_UPLOADED_EVENT} window event
 *   that uploadAttachment dispatches on success — the bar reflects
 *   new uploads immediately without the caller having to remember.
 * - Hides when activeWorkspaceId is missing (legacy local mode) or
 *   when the quota fetch fails — silent rather than error UI.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { ATTACHMENT_UPLOADED_EVENT, fetchUserQuota } from '@/lib/backend';
import type { WorkspaceQuotaUsage } from '@/lib/backend/types';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';

const REFRESH_MS = 60_000;

export function WorkspaceStorageBadge() {
  const activeWorkspaceId = useSidebarPrefs((s) => s.activeWorkspaceId);
  const [usage, setUsage] = useState<WorkspaceQuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setUsage(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchUserQuota()
      .then((q) => {
        if (cancelled) return;
        setUsage(q.workspaces.find((w) => w.workspaceId === activeWorkspaceId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const onUpload = () => setReloadKey((k) => k + 1);
    window.addEventListener(ATTACHMENT_UPLOADED_EVENT, onUpload);
    const interval = window.setInterval(onUpload, REFRESH_MS);
    return () => {
      cancelled = true;
      window.removeEventListener(ATTACHMENT_UPLOADED_EVENT, onUpload);
      window.clearInterval(interval);
    };
  }, [activeWorkspaceId, reloadKey]);

  if (!activeWorkspaceId) return null;
  if (loading && !usage) {
    return (
      <div className="px-3 py-1.5 text-xs flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        <Loader2 className="h-3 w-3 animate-spin" />
        용량 조회 중...
      </div>
    );
  }
  if (!usage) return null;

  const used = usage.attachmentBytes;
  const cap = usage.limits.maxAttachmentBytes;
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;
  const percent = Math.round(ratio * 100);
  const barColor = ratio >= 0.95
    ? 'var(--primary-red)'
    : ratio >= 0.8
      ? 'var(--warning)'
      : 'var(--accent)';

  return (
    <div
      className="px-3 py-1.5 border-t"
      style={{ borderColor: 'var(--border-primary)' }}
      title={`${formatBytes(used)} / ${formatBytes(cap)} 사용 중 (${usage.plan})`}
    >
      <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>저장 용량</span>
        <span>{percent}%</span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: barColor }}
        />
      </div>
      <div className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        {formatBytes(used)} / {formatBytes(cap)}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`;
}
