/**
 * Rationale Block — M2-5. "왜 이 값?" 자동 근거 블록.
 *
 * Attrs: 특정 셀 (sheet/col/row) 을 target.
 * 출력:
 *   - 해당 셀의 changelog 최근 N개 (언제 누가 왜)
 *   - linkedTaskIds 로 연결된 task 리스트
 *   - 참조되는 수식의 의존성 (다른 셀 영향도)
 *
 * 수동 작성 필요 없이 자동 생성 — 북극성 루프의 hero feature.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Lightbulb, ArrowRight, Link as LinkIcon, History } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { detectPmSheet } from '@/lib/pmSheetDetection';

interface RationaleAttrs {
  projectId: string;
  sheetId: string;
  columnId: string;
  rowId: string;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  return s.length > 20 ? s.slice(0, 18) + '…' : s;
}

function RationaleView({ node }: NodeViewProps) {
  const t = useTranslations('docs');
  const tHome = useTranslations('home');
  const locale = useLocale();
  const formatRelative = (ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    if (m < 60) return tHome('relMinAgo', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return tHome('relHourAgo', { n: h });
    const d = Math.floor(h / 24);
    if (d < 7) return tHome('relDayAgo', { n: d });
    return new Date(ts).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  };
  const attrs = node.attrs as RationaleAttrs;
  const project = useProjectStore((s) => s.projects.find((p) => p.id === attrs.projectId));
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);

  const summary = useMemo(() => {
    if (!project) return null;
    const sheet = project.sheets.find((s) => s.id === attrs.sheetId);
    if (!sheet) return null;
    const column = sheet.columns.find((c) => c.id === attrs.columnId);
    const row = sheet.rows.find((r) => r.id === attrs.rowId);
    if (!column || !row) return null;

    // 1. 해당 셀의 changelog
    const cellChanges = (project.changelog ?? [])
      .filter(
        (c) =>
          c.sheetId === attrs.sheetId &&
          c.rowId === attrs.rowId &&
          c.columnId === attrs.columnId
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    // 2. linked tasks (changelog 에서 수집)
    const taskIds = new Set<string>();
    for (const c of cellChanges) {
      c.linkedTaskIds?.forEach((t) => taskIds.add(t));
    }
    const linkedTasks: Array<{ id: string; title: string; sheetId: string; sheetName: string }> = [];
    for (const tid of taskIds) {
      for (const s of project.sheets) {
        const r = s.rows.find((x) => x.id === tid);
        if (!r) continue;
        const titleCol = s.columns.find(
          (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
        );
        linkedTasks.push({
          id: tid,
          title: titleCol ? String(r.cells[titleCol.id] ?? '') : tid.slice(0, 8),
          sheetId: s.id,
          sheetName: s.name,
        });
        break;
      }
    }

    // 3. 현재 값
    const currentValue = row.cells[column.id];

    return {
      sheet,
      column,
      row,
      currentValue,
      cellChanges,
      linkedTasks,
    };
  }, [project, attrs.sheetId, attrs.columnId, attrs.rowId]);

  const jumpToCell = () => {
    setCurrentProject(attrs.projectId);
    setCurrentSheet(attrs.sheetId);
    setCurrentDoc(null);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('balruno:focus-cell', {
          detail: { sheetId: attrs.sheetId, rowId: attrs.rowId, columnId: attrs.columnId },
        })
      );
    }, 50);
  };

  const jumpToTask = (sheetId: string) => {
    setCurrentProject(attrs.projectId);
    setCurrentSheet(sheetId);
    setCurrentDoc(null);
  };

  if (!summary) {
    return (
      <NodeViewWrapper>
        <div
          className="my-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
          contentEditable={false}
        >
          {t('rationaleNotFound')}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className="my-3 rounded-xl border"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          borderLeft: '3px solid #a855f7',
        }}
        contentEditable={false}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <Lightbulb className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('rationaleHeading', { sheet: summary.sheet.name, column: summary.column.name })}
          </span>
          <span className="ml-auto text-caption font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {t('rationaleCurrent', { value: formatValue(summary.currentValue) })}
          </span>
          <button
            type="button"
            onClick={jumpToCell}
            className="text-caption flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-[var(--bg-hover)]"
            style={{ color: '#a855f7' }}
          >
            {t('rationaleJumpToCell')}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Change history */}
          <section>
            <div className="flex items-center gap-1 text-overline mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              <History className="w-3 h-3" />
              {t('rationaleHistory')} {summary.cellChanges.length > 0 && `(${summary.cellChanges.length})`}
            </div>
            {summary.cellChanges.length === 0 ? (
              <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
                {t('rationaleHistoryEmpty')}
              </p>
            ) : (
              <div className="space-y-1">
                {summary.cellChanges.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 text-caption px-2 py-1 rounded"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {formatRelative(c.timestamp)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {c.userName || c.userId}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded font-mono text-caption"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        textDecoration: 'line-through',
                      }}
                    >
                      {formatValue(c.before)}
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <span
                      className="px-1.5 py-0.5 rounded font-mono text-caption"
                      style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                    >
                      {formatValue(c.after)}
                    </span>
                    {c.reason && (
                      <span className="italic truncate flex-1" style={{ color: 'var(--text-tertiary)' }}>
                        &ldquo;{c.reason}&rdquo;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Linked tasks */}
          {summary.linkedTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-1 text-overline mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                <LinkIcon className="w-3 h-3" />
                {t('rationaleLinkedTasks')} ({summary.linkedTasks.length})
              </div>
              <div className="space-y-1">
                {summary.linkedTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => jumpToTask(t.sheetId)}
                    className="w-full flex items-center gap-2 text-caption px-2 py-1 rounded text-left hover:bg-[var(--bg-hover)]"
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  >
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                      {t.sheetName}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const RationaleBlock = Node.create({
  name: 'rationaleBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      projectId: { default: '' },
      sheetId: { default: '' },
      columnId: { default: '' },
      rowId: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-rationale-block]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            projectId: el.getAttribute('data-project') || '',
            sheetId: el.getAttribute('data-sheet') || '',
            columnId: el.getAttribute('data-col') || '',
            rowId: el.getAttribute('data-row') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-rationale-block': 'true',
        'data-project': node.attrs.projectId,
        'data-sheet': node.attrs.sheetId,
        'data-col': node.attrs.columnId,
        'data-row': node.attrs.rowId,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RationaleView);
  },
});

export default RationaleBlock;
