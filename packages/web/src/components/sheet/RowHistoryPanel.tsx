'use client';

/**
 * RowHistoryPanel — 행 단위 cell-level 변경 이력 (ADR 0038 Stage A).
 *
 * 행 우클릭 → "변경 이력" → 화면 가운데 모달. backend 가
 * workspace plan 의 historyRetentionDays 로 cutoff 적용한 결과만
 * 반환하니 frontend 는 그대로 list 에 표시한다.
 *
 * Portal 로 document.body 에 mount — 사이드바 transform 컨테이닝
 * 블록 함정 회피.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { fetchRowHistory, type HistoryEntry } from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

interface Props {
  projectId: string;
  sheetId: string;
  rowId: string;
  rowLabel: string;
  onClose: () => void;
}

export default function RowHistoryPanel({
  projectId,
  sheetId,
  rowId,
  rowLabel,
  onClose,
}: Props) {
  const t = useTranslations('rowHistory');
  const myUserId = useBackendAuthStore((s) => s.user?.id);

  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchRowHistory(projectId, sheetId, rowId, { limit: 100 })
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
  }, [projectId, sheetId, rowId, t]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '70vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <History className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            {t('heading', { row: rowLabel })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[var(--bg-hover)]"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex h-full items-center justify-center py-10">
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
                <Row key={e.id} entry={e} myUserId={myUserId} t={t} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  entry,
  myUserId,
  t,
}: {
  entry: HistoryEntry;
  myUserId: string | undefined;
  t: ReturnType<typeof useTranslations<'rowHistory'>>;
}) {
  const actorLabel =
    !entry.actorUserId
      ? t('actorSystem')
      : entry.actorUserId === myUserId
        ? t('actorSelf')
        : `User ${entry.actorUserId.slice(0, 6)}`;

  const summary = describeAction(entry, t);
  const when = formatRelative(entry.createdAt);

  return (
    <li className="rounded-md px-2 py-1.5 text-xs" style={{ background: 'var(--bg-secondary)' }}>
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

function describeAction(
  entry: HistoryEntry,
  t: ReturnType<typeof useTranslations<'rowHistory'>>,
): string {
  const key = `actions.${entry.action.replace(/\./g, '_')}`;
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
