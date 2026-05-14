'use client';

/**
 * Stage F — "Add from template" modal (ADR 0020).
 *
 * Lists starter pack groups returned by GET /v1/catalog and lets the
 * user import one onto the current project. The actual mutation
 * happens server-side; this component only owns the loading / picker
 * UI and forwards onPick to the page handler.
 *
 * Locale flows through from the user (when available) so a Korean
 * caller sees Korean catalog labels even if the browser language is
 * different. Falls back to whatever the backend ships under {@code
 * catalog-ko.json} when the requested locale's file is missing.
 */

import { useEffect, useState } from 'react';
import { Loader2, X, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { listCatalog, type CatalogGroupSummary } from '@/lib/backend';

interface TemplateImportModalProps {
  open: boolean;
  locale?: string;
  /** Closed without picking. */
  onClose: () => void;
  /** User picked a group — page calls importTemplate + closes. */
  onPick: (group: CatalogGroupSummary) => Promise<void> | void;
}

export function TemplateImportModal({
  open,
  locale,
  onClose,
  onPick,
}: TemplateImportModalProps) {
  const t = useTranslations('common');
  const [groups, setGroups] = useState<CatalogGroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  // groups === null while loading; the catalog ships with the build
  // so we cache the result across repeat opens of the same session.
  const loading = open && groups === null && !error;

  useEffect(() => {
    if (!open || groups || error) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listCatalog(locale);
        if (!cancelled) setGroups(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '카탈로그를 불러오지 못했습니다.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, locale, groups, error]);

  if (!open) return null;

  const handlePick = async (group: CatalogGroupSummary) => {
    if (picking) return;
    setPicking(group.id);
    try {
      await onPick(group);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '템플릿을 가져오지 못했습니다.');
    } finally {
      setPicking(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border p-5 shadow-xl"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            템플릿에서 가져오기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          시작용 시트 묶음 — 선택하면 현재 프로젝트의 시트 트리에 폴더와 함께 추가됩니다.
        </p>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            카탈로그 로딩 중...
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!loading && groups && groups.length === 0 && (
          <p className="py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            가져올 수 있는 템플릿이 없습니다.
          </p>
        )}

        {!loading && groups && groups.length > 0 && (
          <ul
            className="space-y-1 overflow-y-auto"
            style={{ maxHeight: 'calc(80vh - 140px)' }}
          >
            {groups.map((group) => {
              const isPickingThis = picking === group.id;
              const dotColor = group.color ?? 'var(--text-tertiary)';
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(group)}
                    disabled={!!picking}
                    className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <span
                      className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: dotColor }}
                    />
                    <span className="flex-1">
                      <span
                        className="block text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {group.name}
                      </span>
                      {group.description && (
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {group.description}
                        </span>
                      )}
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-xs"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        시트 {group.sheetCount}개
                      </span>
                    </span>
                    {isPickingThis && (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
