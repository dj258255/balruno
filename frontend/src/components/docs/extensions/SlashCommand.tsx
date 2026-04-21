'use client';

/**
 * Slash Command 확장 — M1-3.
 *
 * `/` 입력 시 popover 메뉴 노출 → heading / list / code / callout 등 삽입.
 * M2 에서 custom blocks (livecell / chart / sim / task) 도 이 메뉴에 추가.
 *
 * 참고: tiptap 공식 문서의 Suggestion extension 패턴.
 */

import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import type { Editor, Range } from '@tiptap/core';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Minus,
} from 'lucide-react';

export interface SlashCommandItem {
  title: string;
  description?: string;
  icon?: LucideIcon;
  keywords?: string[];
  command: (args: { editor: Editor; range: Range }) => void;
}

const DEFAULT_ITEMS: SlashCommandItem[] = [
  {
    title: '제목 1',
    description: '큰 제목',
    icon: Heading1,
    keywords: ['h1', 'heading1', 'title', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    title: '제목 2',
    description: '섹션 제목',
    icon: Heading2,
    keywords: ['h2', 'heading2', '섹션'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    title: '제목 3',
    description: '하위 제목',
    icon: Heading3,
    keywords: ['h3', 'heading3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    title: '글머리 목록',
    description: '단순 리스트',
    icon: List,
    keywords: ['bullet', 'ul', 'list', '목록'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: '번호 목록',
    description: '순서 있는 리스트',
    icon: ListOrdered,
    keywords: ['ol', 'numbered', '번호'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: '인용문',
    description: '블록 인용',
    icon: Quote,
    keywords: ['quote', 'blockquote', '인용'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: '코드 블록',
    description: '여러 줄 코드',
    icon: Code,
    keywords: ['code', 'codeblock', '코드'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: '구분선',
    description: '수평선',
    icon: Minus,
    keywords: ['hr', 'divider', 'rule', '구분'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

interface SlashMenuListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const SlashMenuList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SlashMenuListProps
>((props, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
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
      className="glass-panel max-h-80 overflow-y-auto p-1 min-w-[260px]"
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
              key={item.title}
              onClick={() => selectItem(i)}
              onMouseEnter={() => setSelected(i)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              {Icon && (
                <div
                  className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.title}</div>
                {item.description && (
                  <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {item.description}
                  </div>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
});

SlashMenuList.displayName = 'SlashMenuList';

export interface SlashCommandOptions {
  items?: SlashCommandItem[];
  suggestion?: Partial<SuggestionOptions>;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      items: DEFAULT_ITEMS,
    };
  },

  addProseMirrorPlugins() {
    const items = this.options.items ?? DEFAULT_ITEMS;
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).command({ editor, range });
        },
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          if (!q) return items.slice(0, 10);
          return items
            .filter((item) => {
              if (item.title.toLowerCase().includes(q)) return true;
              if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
              return false;
            })
            .slice(0, 10);
        },
        render: () => {
          let component: ReactRenderer<{ onKeyDown: (p: { event: KeyboardEvent }) => boolean }> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenuList, {
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
      }),
    ];
  },
});

export default SlashCommand;
