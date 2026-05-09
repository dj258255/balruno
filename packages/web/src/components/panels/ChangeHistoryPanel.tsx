'use client';

/**
 * ChangeHistoryPanel — workspace audit log viewer (ADR 0032 v1.0).
 *
 * Backend ApplicationEvent → AuditEventListener → workspace_audit_log.
 * This panel just lists newest-first with friendly per-action labels.
 *
 * Scope is workspace-wide on purpose: backend events cover member /
 * project / comment / webhook / discord etc. Cell-level history
 * (cell.update / row.add) lives in the sync op_log and isn't surfaced
 * here yet — that's a separate ADR.
 *
 * The panel currently keeps its dock slot inside the share group; a
 * future move into the workspace settings modal is parked as a
 * follow-up because layout state in localStorage shouldn't shift
 * mid-session.
 */

import { useEffect, useState } from 'react';
import { History, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { fetchAuditLog, type AuditEntry } from '@/lib/backend';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';
import { useWorkspaceListStore } from '@/stores/workspaceListStore';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

interface Props {
  onClose?: () => void;
}

export default function ChangeHistoryPanel({ onClose }: Props) {
  const t = useTranslations('changeHistory');
  const activeWorkspaceId = useSidebarPrefs((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceListStore((s) => s.workspaces);
  const myUserId = useBackendAuthStore((s) => s.user?.id);

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAuditLog(activeWorkspaceId, { limit: 100 })
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('loadFailed'));
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, reloadKey, t]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <History className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          {t('heading')}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded p-1 hover:bg-[var(--bg-hover)]"
          aria-label={t('refresh')}
          title={t('refresh')}
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && entries === null ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : error ? (
          <p className="px-2 py-3 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : !entries || entries.length === 0 ? (
          <p className="px-2 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('empty')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <AuditRow key={e.id} entry={e} myUserId={myUserId} t={t} />
            ))}
          </ul>
        )}
      </div>

      {onClose && (
        <div className="border-t px-3 py-2 text-right" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1 text-xs"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            {t('close')}
          </button>
        </div>
      )}

      {/* Workspace fallback note — most users have one workspace, so
          they won't see this. Multi-workspace users get a hint that
          the panel is scoped to their currently active workspace. */}
      {!activeWorkspaceId && workspaces.length > 1 && (
        <p
          className="border-t px-3 py-2 text-[11px]"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
        >
          {t('selectWorkspaceHint')}
        </p>
      )}
    </div>
  );
}

function AuditRow({
  entry,
  myUserId,
  t,
}: {
  entry: AuditEntry;
  myUserId: string | undefined;
  t: ReturnType<typeof useTranslations<'changeHistory'>>;
}) {
  // Actor labelling — single-developer prod: a per-workspace user
  // name index is a separate ADR (the existing /me endpoint is
  // self-only). For now: '나' for the current user, a short hex
  // suffix for everyone else, and the system label for null actors
  // (cron, etc.). Replace with name lookup when the user index
  // endpoint lands.
  const actorLabel =
    !entry.actorUserId
      ? t('actorSystem')
      : entry.actorUserId === myUserId
        ? t('actorSelf')
        : `User ${entry.actorUserId.slice(0, 6)}`;

  const summary = describeAction(entry, t);
  const when = formatRelative(entry.createdAt);

  return (
    <li
      className="rounded-md px-2 py-1.5 text-xs"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {actorLabel}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>{when}</span>
      </div>
      <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>
        {summary}
      </div>
    </li>
  );
}

/**
 * Human label for an audit action. Backed by per-action i18n keys —
 * unknown actions fall through to a generic "performed {action}"
 * line so a brand-new event from the backend doesn't break the view.
 */
function describeAction(
  entry: AuditEntry,
  t: ReturnType<typeof useTranslations<'changeHistory'>>,
): string {
  const key = `actions.${entry.action.replace(/\./g, '_')}`;
  // useTranslations 의 키가 없을 때 fall-back. raw 키 형태 그대로
  // 출력되면 unknown — 그 때만 fallback 라벨로.
  let label: string;
  try {
    label = t(key as 'actions.fallback');
  } catch {
    label = key;
  }
  if (label === key) {
    return t('actionFallback', { action: entry.action });
  }
  return label;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString();
}
