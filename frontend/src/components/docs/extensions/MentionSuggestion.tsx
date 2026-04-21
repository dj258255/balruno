'use client';

/**
 * @Mention 확장 — M1-4.
 *
 * `@` 입력 시 sheet / task / doc / cell 후보 리스트 표시.
 * 선택 시 문서에 tiptap Mention 노드로 삽입 (나중에 @sheet:... 같은 syntax 로도 export 가능).
 */

import Mention from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileSpreadsheet, FileText, Zap, Bug, Gamepad2 } from 'lucide-react';
import type { Project } from '@/types';
import { detectPmSheet } from '@/lib/pmSheetDetection';

export interface MentionCandidate {
  /** 고유 id (Mention 노드의 id attribute) */
  id: string;
  /** 화면 표시 라벨 */
  label: string;
  /** 상세 경로 (예: 시트/컬럼) */
  hint?: string;
  /** 참조 종류 */
  kind: 'sheet' | 'cell' | 'task' | 'doc';
  icon?: LucideIcon;
  color?: string;
}

function buildCandidates(project: Project | null | undefined): MentionCandidate[] {
  if (!project) return [];
  const out: MentionCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: MentionCandidate) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
  };

  // 각 문서
  for (const d of project.docs ?? []) {
    push({
      id: `doc:${d.id}`,
      label: d.name || '(제목 없음)',
      hint: '문서',
      kind: 'doc',
      icon: FileText,
      color: '#10b981',
    });
  }

  // 시트 (+ PM 타입 감지). id 는 sheet.id 로 유니크화 (이름 중복 허용).
  for (const sheet of project.sheets) {
    const pm = detectPmSheet(sheet);
    let icon: LucideIcon = FileSpreadsheet;
    let color = '#3b82f6';
    if (pm.type === 'sprint' || pm.type === 'generic-pm') {
      icon = Zap;
      color = '#3b82f6';
    } else if (pm.type === 'bug') {
      icon = Bug;
      color = '#ef4444';
    } else if (pm.type === 'playtest') {
      icon = Gamepad2;
      color = '#10b981';
    }
    push({
      id: `sheet:${sheet.id}`,
      label: sheet.name,
      hint: `${sheet.columns.length} 컬럼 · ${sheet.rows.length} 행`,
      kind: 'sheet',
      icon,
      color,
    });

    // PM 시트 row 들도 task 후보로. row.id 가 시트 간 중복될 수 있어 sheet 스코프 prefix.
    if (pm.type) {
      const titleCol = sheet.columns.find(
        (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
      );
      for (const row of sheet.rows.slice(0, 100)) {
        const label = titleCol ? String(row.cells[titleCol.id] ?? '(제목 없음)') : row.id.slice(0, 8);
        push({
          id: `task:${sheet.id}:${row.id}`,
          label,
          hint: sheet.name,
          kind: 'task',
          icon,
          color,
        });
      }
    }
  }

  return out;
}

interface ListProps {
  items: MentionCandidate[];
  command: (item: MentionCandidate) => void;
}

const MentionList = forwardRef<
  { onKeyDown: (p: { event: KeyboardEvent }) => boolean },
  ListProps
>((props, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [props.items]);

  const selectItem = (i: number) => {
    const item = props.items[i];
    if (item) props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selected);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      className="glass-panel max-h-72 overflow-y-auto p-1 min-w-[280px]"
      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
    >
      {props.items.length === 0 ? (
        <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          결과 없음
        </div>
      ) : (
        props.items.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === selected;
          return (
            <button
              key={item.id}
              onClick={() => selectItem(i)}
              onMouseEnter={() => setSelected(i)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              {Icon && (
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.color }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {item.label}
                </div>
                {item.hint && (
                  <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {item.hint}
                  </div>
                )}
              </div>
              <span
                className="text-caption px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {item.kind}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export function createMentionExtension(getProject: () => Project | null | undefined) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'mention-node',
    },
    renderText({ node }) {
      return `@${(node.attrs.label as string) ?? node.attrs.id}`;
    },
    suggestion: {
      char: '@',
      allowSpaces: false,
      items: ({ query }: { query: string }) => {
        const all = buildCandidates(getProject());
        const q = query.toLowerCase().trim();
        if (!q) return all.slice(0, 10);
        return all
          .filter((item) => {
            if (item.label.toLowerCase().includes(q)) return true;
            if (item.hint?.toLowerCase().includes(q)) return true;
            if (item.kind.includes(q)) return true;
            return false;
          })
          .slice(0, 10);
      },
      render: () => {
        let component: ReactRenderer<{ onKeyDown: (p: { event: KeyboardEvent }) => boolean }> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });
            if (!props.clientRect) return;
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              theme: 'balruno',
              arrow: false,
            });
          },
          onUpdate: (props) => {
            component?.updateProps(props);
            if (!props.clientRect || !popup) return;
            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              popup?.[0].hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.[0].destroy();
            component?.destroy();
          },
        };
      },
    } as Partial<SuggestionOptions>,
  });
}
