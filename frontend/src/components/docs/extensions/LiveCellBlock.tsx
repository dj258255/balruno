'use client';

/**
 * LiveCell Block — M2-1.
 *
 * 인라인 노드: 문서 안에 시트 셀 값을 실시간 표시.
 * 수식 변경 시 자동 반영 (zustand subscribe).
 *
 * Syntax (저장용):
 *   <span data-live-cell data-sheet="..." data-col="..." data-row="..."></span>
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ArrowRight } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { computeSheetRows } from '@/lib/formulaEngine';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

export interface LiveCellAttrs {
  projectId: string;
  sheetId: string;
  columnId: string;
  rowId: string;
  label?: string;
}

function LiveCellView({ node }: NodeViewProps) {
  const tCell = useTranslations('liveCell');
  const attrs = node.attrs as LiveCellAttrs;
  const project = useProjectStore((s) => s.projects.find((p) => p.id === attrs.projectId));
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);

  const { value, label, broken } = useMemo(() => {
    if (!project) return { value: '—', label: tCell('noProject'), broken: true };
    const sheet = project.sheets.find((s) => s.id === attrs.sheetId);
    if (!sheet) return { value: '—', label: tCell('noSheet'), broken: true };
    const column = sheet.columns.find((c) => c.id === attrs.columnId);
    if (!column) return { value: '—', label: tCell('noColumn'), broken: true };
    const row = sheet.rows.find((r) => r.id === attrs.rowId);
    if (!row) return { value: '—', label: tCell('noRow'), broken: true };

    let v: unknown = row.cells[column.id];
    const isFormula = column.type === 'formula' || (typeof v === 'string' && String(v).startsWith('='));
    if (isFormula) {
      try {
        const computed = computeSheetRows(sheet, project.sheets);
        const cRow = computed[sheet.rows.indexOf(row)];
        if (cRow) v = cRow[column.name];
      } catch {
        // fallback
      }
    }
    const displayValue = v === null || v === undefined || v === '' ? '—' : String(v);
    return {
      value: displayValue,
      label: `${sheet.name}/${column.name}`,
      broken: false,
    };
  }, [project, attrs.sheetId, attrs.columnId, attrs.rowId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <NodeViewWrapper as="span" className="live-cell-wrapper">
      <button
        type="button"
        onClick={handleClick}
        className="live-cell"
        data-broken={broken}
        title={label}
      >
        <span className="live-cell-value">{value}</span>
        <ArrowRight className="live-cell-arrow" />
      </button>
    </NodeViewWrapper>
  );
}

export const LiveCellBlock = Node.create({
  name: 'liveCell',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      projectId: { default: '' },
      sheetId: { default: '' },
      columnId: { default: '' },
      rowId: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-live-cell]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            projectId: el.getAttribute('data-project') || '',
            sheetId: el.getAttribute('data-sheet') || '',
            columnId: el.getAttribute('data-col') || '',
            rowId: el.getAttribute('data-row') || '',
            label: el.getAttribute('data-label') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-live-cell': 'true',
        'data-project': node.attrs.projectId,
        'data-sheet': node.attrs.sheetId,
        'data-col': node.attrs.columnId,
        'data-row': node.attrs.rowId,
        'data-label': node.attrs.label,
      }),
      node.attrs.label || 'cell',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LiveCellView);
  },
});

export default LiveCellBlock;
