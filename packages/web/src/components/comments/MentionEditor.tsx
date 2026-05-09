'use client';

/**
 * MentionEditor — Tiptap rich-text editor that emits comment-shape
 * JSON body with `@mention` nodes (ADR 0024 Stage F).
 *
 * - Document + Paragraph + Text from StarterKit core
 * - Mention extension with `@` trigger, suggestion source =
 *   listWorkspaceMembers(workspaceId). Selecting a member inserts
 *   `{type: 'mention', attrs: {id: userId, label: name}}` — same
 *   shape the backend MentionExtractor walks to record mentions
 *   on the comment.
 * - Cmd/Ctrl+Enter submits via onSubmit prop. Plain Enter inserts
 *   a hard break so multi-line bodies still work.
 *
 * The Suggestion popup is a tippy-positioned React subtree rendered
 * via ReactRenderer. tippy is already a transitive dep of the
 * official Tiptap mention example and ships with the codebase.
 */

import { forwardRef, useImperativeHandle, useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import type { JSONContent } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

import { listWorkspaceMembers, resolveMediaUrl } from '@/lib/backend';
import type { WorkspaceMemberView } from '@/lib/backend/types';

export interface MentionEditorHandle {
  /** Imperative reset — used by the surrounding panel after a successful post. */
  clear: () => void;
  /** Read the current JSON body without going through onChange — useful when the
   *  panel only consumes the body at submit time. */
  getJson: () => JSONContent;
}

interface MentionEditorProps {
  /** Workspace whose members appear in the @ suggestion list. When
   *  undefined the editor still works but suggestions stay empty
   *  (legacy local-mode fallback). */
  workspaceId: string | undefined;
  /** Initial body. Pass null for an empty editor. Used for both
   *  fresh-comment compose and edit-in-place scenarios. */
  initialJson?: JSONContent | null;
  /** Submit on Cmd/Ctrl+Enter. The panel typically posts the comment
   *  and then calls clear() via the ref. */
  onSubmit?: () => void;
  /** Focus + content change observer. */
  onChange?: (json: JSONContent) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Tailwind sizing override. The default fits a 3-line composer
   *  inside the comment panels; doc inline reuses with a smaller
   *  min-h. */
  className?: string;
}

const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(
  function MentionEditor(
    { workspaceId, initialJson, onSubmit, onChange, placeholder, disabled, className },
    ref,
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // keep the editor minimal — comments don't need lists / headings.
          heading: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Placeholder.configure({ placeholder: placeholder ?? '코멘트를 입력하세요...' }),
        Mention.configure({
          HTMLAttributes: { class: 'balruno-mention' },
          renderText({ options, node }) {
            return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
          },
          suggestion: buildSuggestion(workspaceId),
        }),
      ],
      content: initialJson ?? '',
      editable: !disabled,
      // SSR mismatch guard — the comment panels mount client-side only,
      // but Next.js 16 still warns without the explicit flag.
      immediatelyRender: false,
      onUpdate({ editor }) {
        onChange?.(editor.getJSON());
      },
      editorProps: {
        attributes: {
          // role + aria-label keep the textarea's a11y story while
          // the visual surface is a contenteditable.
          role: 'textbox',
          'aria-label': placeholder ?? '코멘트',
          class: 'balruno-mention-editor focus:outline-none',
        },
        handleKeyDown(_, event) {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onSubmit?.();
            return true;
          }
          return false;
        },
      },
    });

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          editor?.commands.clearContent(true);
        },
        getJson: () => editor?.getJSON() ?? { type: 'doc', content: [] },
      }),
      [editor],
    );

    return (
      <div
        className={
          className ??
          'min-h-[60px] rounded-md border px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-[var(--accent)]/40'
        }
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    );
  },
);

export default MentionEditor;

/**
 * Build the @-trigger suggestion config bound to a workspace.
 * Pulled out so the tippy / ReactRenderer plumbing is testable
 * without a full editor harness.
 */
function buildSuggestion(workspaceId: string | undefined): Partial<SuggestionOptions<MentionItem>> {
  return {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }): Promise<MentionItem[]> => {
      if (!workspaceId) return [];
      try {
        const members = await listWorkspaceMembers(workspaceId);
        const q = query.trim().toLowerCase();
        return members
          .filter((m): m is WorkspaceMemberView & { user: NonNullable<WorkspaceMemberView['user']> } => !!m.user)
          .filter((m) => {
            if (!q) return true;
            const hay = `${m.user.name ?? ''} ${m.user.email}`.toLowerCase();
            return hay.includes(q);
          })
          .slice(0, 8)
          .map((m) => ({
            id: m.userId,
            label: m.user.name ?? m.user.email,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
          }));
      } catch {
        return [];
      }
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle, MentionListProps> | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props: toListProps(props),
            editor: props.editor,
          });
          if (!props.clientRect) return;
          popup = tippy(document.body, {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate(props) {
          component?.updateProps(toListProps(props));
          if (!props.clientRect) return;
          popup?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },
        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit() {
          popup?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

interface MentionItem {
  id: string;
  label: string;
  email: string;
  avatarUrl: string | null;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

function toListProps(props: SuggestionProps<MentionItem>): MentionListProps {
  return {
    items: props.items,
    command: props.command,
  };
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { items, command },
  ref,
) {
  const [selected, setSelected] = useState(0);

  // Reset highlight whenever the candidate list shifts (new query).
  useEffect(() => setSelected(0), [items]);

  const pick = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      command({ id: item.id, label: item.label });
    },
    [items, command],
  );

  const upHandler = useCallback(() => {
    if (items.length === 0) return;
    setSelected((s) => (s + items.length - 1) % items.length);
  }, [items.length]);

  const downHandler = useCallback(() => {
    if (items.length === 0) return;
    setSelected((s) => (s + 1) % items.length);
  }, [items.length]);

  // Tiptap delegates raw KeyboardEvents in to give us first crack at
  // arrow keys / Enter without the editor swallowing them.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          pick(selectedRef.current);
          return true;
        }
        return false;
      },
    }),
    [upHandler, downHandler, pick],
  );

  if (items.length === 0) {
    return (
      <div
        className="rounded-md border px-3 py-2 text-xs shadow-lg"
        role="status"
        aria-live="polite"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-tertiary)',
        }}
      >
        멤버 없음
      </div>
    );
  }

  return (
    <ul
      className="max-h-64 min-w-[220px] overflow-y-auto rounded-md border py-1 shadow-lg"
      role="listbox"
      aria-label="멤버 멘션"
      aria-live="polite"
      aria-activedescendant={`mention-opt-${items[selected]?.id ?? ''}`}
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {items.map((item, idx) => (
        <li key={item.id} role="presentation">
          <button
            type="button"
            id={`mention-opt-${item.id}`}
            role="option"
            aria-selected={idx === selected}
            onMouseEnter={() => setSelected(idx)}
            onClick={() => pick(idx)}
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
            style={{
              background: idx === selected ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            {item.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaUrl(item.avatarUrl) ?? ''}
                alt=""
                className="h-5 w-5 rounded-full"
              />
            ) : (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {item.label.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {item.email}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
});
