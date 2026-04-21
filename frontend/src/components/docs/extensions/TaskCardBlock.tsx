'use client';

/**
 * Task Card Block — M2-3.
 *
 * 블록 노드: 태스크 row 를 카드 preview 로 렌더.
 * 상태/담당자/우선순위/Due 표시.
 * 클릭 시 해당 태스크로 점프.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Zap, Bug, Gamepad2, User, Calendar, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { detectPmSheet } from '@/lib/pmSheetDetection';

function TaskCardView({ node }: NodeViewProps) {
  const attrs = node.attrs as { projectId: string; rowId: string };
  const project = useProjectStore((s) => s.projects.find((p) => p.id === attrs.projectId));
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);

  const info = useMemo(() => {
    if (!project) return null;
    for (const sheet of project.sheets) {
      const row = sheet.rows.find((r) => r.id === attrs.rowId);
      if (!row) continue;
      const pm = detectPmSheet(sheet);
      const titleCol = sheet.columns.find(
        (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
      );
      const statusCol = pm.statusColumnId ? sheet.columns.find((c) => c.id === pm.statusColumnId) : null;
      const assigneeCol = pm.assigneeColumnId ? sheet.columns.find((c) => c.id === pm.assigneeColumnId) : null;
      const priorityCol = sheet.columns.find(
        (c) => c.name.toLowerCase() === 'priority' || c.name.toLowerCase() === '우선순위'
      );
      const dueCol = sheet.columns.find((c) => c.type === 'date');

      const statusVal = statusCol ? String(row.cells[statusCol.id] ?? '') : '';
      const statusOpt = statusCol?.selectOptions?.find((o) => o.id === statusVal);

      return {
        sheet,
        row,
        title: titleCol ? String(row.cells[titleCol.id] ?? '(제목 없음)') : '(제목 없음)',
        status: statusOpt ? { label: statusOpt.label, color: statusOpt.color } : null,
        assignee: assigneeCol ? String(row.cells[assigneeCol.id] ?? '') : '',
        priority: priorityCol
          ? priorityCol.selectOptions?.find((o) => o.id === row.cells[priorityCol.id])
          : null,
        due: dueCol ? String(row.cells[dueCol.id] ?? '') : '',
        pmType: pm.type,
      };
    }
    return null;
  }, [project, attrs.rowId]);

  const handleClick = () => {
    if (!info) return;
    setCurrentProject(attrs.projectId);
    setCurrentSheet(info.sheet.id);
    setCurrentDoc(null);
  };

  if (!info) {
    return (
      <NodeViewWrapper>
        <div
          className="my-2 px-3 py-2 rounded-lg border text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#dc2626',
          }}
          contentEditable={false}
        >
          태스크 없음: {attrs.rowId}
        </div>
      </NodeViewWrapper>
    );
  }

  const Icon = info.pmType === 'bug' ? Bug : info.pmType === 'playtest' ? Gamepad2 : Zap;
  const color = info.pmType === 'bug' ? '#ef4444' : info.pmType === 'playtest' ? '#10b981' : '#3b82f6';

  return (
    <NodeViewWrapper>
      <div
        className="my-2 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow"
        style={{
          background: 'var(--bg-secondary)',
          borderLeft: `3px solid ${color}`,
          borderColor: 'var(--border-primary)',
        }}
        onClick={handleClick}
        contentEditable={false}
      >
        <div className="flex items-start gap-3 p-3">
          <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {info.title}
              </span>
              {info.status && (
                <span
                  className="text-caption px-1.5 py-0.5 rounded-full"
                  style={{
                    background: info.status.color ? `${info.status.color}20` : 'var(--bg-tertiary)',
                    color: info.status.color ?? 'var(--text-secondary)',
                  }}
                >
                  {info.status.label}
                </span>
              )}
              {info.priority && (
                <span
                  className="text-caption px-1.5 py-0.5 rounded-full"
                  style={{
                    background: info.priority.color ? `${info.priority.color}20` : 'var(--bg-tertiary)',
                    color: info.priority.color ?? 'var(--text-secondary)',
                  }}
                >
                  {info.priority.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
              <span>{info.sheet.name}</span>
              {info.assignee && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {info.assignee}
                </span>
              )}
              {info.due && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {info.due}
                </span>
              )}
            </div>
          </div>
          <ExternalLink className="w-3 h-3 flex-shrink-0 mt-1" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const TaskCardBlock = Node.create({
  name: 'taskCard',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      projectId: { default: '' },
      rowId: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-task-card]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            projectId: el.getAttribute('data-project') || '',
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
        'data-task-card': 'true',
        'data-project': node.attrs.projectId,
        'data-row': node.attrs.rowId,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskCardView);
  },
});

export default TaskCardBlock;
