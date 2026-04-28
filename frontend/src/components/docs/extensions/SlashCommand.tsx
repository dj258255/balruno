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
import { useTranslations } from 'next-intl';

export interface SlashCommandItem {
  /** legacy: 직접 string 으로 표시할 때 사용 */
  title?: string;
  /** i18n 키. 우선됨. */
  titleKey?: string;
  description?: string;
  /** i18n 키 — description 우선됨 */
  descKey?: string;
  icon?: LucideIcon;
  keywords?: string[];
  command: (args: { editor: Editor; range: Range }) => void;
}

const DEFAULT_ITEMS: SlashCommandItem[] = [
  {
    titleKey: 'slashCommand.h1Title',
    descKey: 'slashCommand.h1Desc',
    icon: Heading1,
    keywords: ['h1', 'heading1', 'title'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    titleKey: 'slashCommand.h2Title',
    descKey: 'slashCommand.h2Desc',
    icon: Heading2,
    keywords: ['h2', 'heading2'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    titleKey: 'slashCommand.h3Title',
    descKey: 'slashCommand.h3Desc',
    icon: Heading3,
    keywords: ['h3', 'heading3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    titleKey: 'slashCommand.ulTitle',
    descKey: 'slashCommand.ulDesc',
    icon: List,
    keywords: ['bullet', 'ul', 'list'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    titleKey: 'slashCommand.olTitle',
    descKey: 'slashCommand.olDesc',
    icon: ListOrdered,
    keywords: ['ol', 'numbered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    titleKey: 'slashCommand.quoteTitle',
    descKey: 'slashCommand.quoteDesc',
    icon: Quote,
    keywords: ['quote', 'blockquote'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    titleKey: 'slashCommand.codeTitle',
    descKey: 'slashCommand.codeDesc',
    icon: Code,
    keywords: ['code', 'codeblock'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    titleKey: 'slashCommand.hrTitle',
    descKey: 'slashCommand.hrDesc',
    icon: Minus,
    keywords: ['hr', 'divider', 'rule'],
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
  const t = useTranslations();
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
          {t('slashCommand.noResult')}
        </div>
      ) : (
        props.items.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === selected;
          return (
            <button
              key={t(item.titleKey as 'slashCommand.h1Title')}
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
                <div className="text-sm font-medium truncate">{item.titleKey ? t(item.titleKey as 'slashCommand.h1Title') : (item.title ?? '')}</div>
                {(item.descKey || item.description) && (
                  <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {item.descKey ? t(item.descKey as 'slashCommand.h1Desc') : item.description}
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
              const title = item.title ?? item.titleKey ?? '';
              if (title.toLowerCase().includes(q)) return true;
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
      }),
    ];
  },
});

export default SlashCommand;
