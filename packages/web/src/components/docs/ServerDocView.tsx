'use client';

/**
 * ServerDocView — minimal collaborative document editor for the
 * server-canonical project page. Bypasses the local-mode DocView
 * (which writes to projectStore.updateDoc / deleteDoc); the doc body
 * lives entirely in the Y.Doc, persisted by Hocuspocus + y-indexeddb.
 *
 * The doc title is part of the doc_tree leaf, not the Y.Doc — the
 * sidebar's inline rename (tree.rename op) is the canonical edit
 * surface for it. This view shows the title as a read-only header.
 *
 * Real-time presence (cursors / selections) flows through the
 * @tiptap/extension-collaboration-cursor extension that useDocCollab
 * already wires; until awareness is plumbed through Hocuspocus the
 * cursor is a no-op stub but the editor itself is fully collaborative
 * via Y.Doc updates.
 */

import { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useDocCollab } from '@/hooks/useDocCollab';
import { useCommentSelectionStore } from '@/stores/commentSelectionStore';
import { listCommentsForDoc } from '@/lib/backend';
import { MobileTiptapToolbar } from './MobileTiptapToolbar';

interface ServerDocViewProps {
  documentId: string;
  /** Project the doc belongs to — needed for range-highlight comment
   *  fetch (Comment F.2) and panel refetch on broadcast. */
  projectId: string;
  /** The doc tree leaf's name. Inline-editable in the header — Enter
   *  or blur commits via onTitleChange; Escape reverts. */
  title: string;
  /** Commit a renamed title — page wires this to docTreeOps.rename
   *  so the change emits tree.rename and propagates to peers. */
  onTitleChange?: (next: string) => void;
}

export function ServerDocView({ documentId, projectId, title, onTitleChange }: ServerDocViewProps) {
  const { extensions: collabExtensions, doc, status } = useDocCollab(documentId);

  // Tracks the user's current text selection inside the editor —
  // used to enable the "comment on selection" header button (Comment
  // F.2). When the selection is empty, the button is disabled and
  // creating a comment falls back to doc-level (anchorPosition = null).
  const [selRange, setSelRange] = useState<{ from: number; to: number } | null>(null);
  const setCommentSelection = useCommentSelectionStore((s) => s.setSelection);
  const setCommentPanelOpen = useCommentSelectionStore((s) => s.setPanelOpen);

  // Range-anchored comments for the active doc — fed into the
  // CommentHighlight plugin so the editor underlines every range.
  // Re-fetches on mount + on every comment-event broadcast (same
  // shape as the panel's refetch — both ways stay in sync).
  const [highlights, setHighlights] = useState<
    Array<{ commentId: string; from: number; to: number; resolved: boolean }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    const refetch = async () => {
      try {
        const list = await listCommentsForDoc(projectId, documentId);
        if (cancelled) return;
        const ranges = list
          .filter((c) => typeof c.anchorPosition === 'number'
                        && typeof c.anchorLength === 'number'
                        && c.anchorLength > 0)
          .map((c) => ({
            commentId: c.id,
            from: c.anchorPosition as number,
            to: (c.anchorPosition as number) + (c.anchorLength as number),
            resolved: c.resolved,
          }));
        setHighlights(ranges);
      } catch {
        /* best-effort */
      }
    };
    void refetch();
    const onPeer = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      if (!detail) return;
      void refetch();
    };
    window.addEventListener('balruno:comment-event', onPeer);
    return () => {
      cancelled = true;
      window.removeEventListener('balruno:comment-event', onPeer);
    };
  }, [documentId, projectId]);

  // Tiptap editor — StarterKit + Placeholder + collab extensions.
  // The Tiptap @collaboration extension manages undo via Y.Doc, but
  // StarterKit's bundled history is harmless when collab extensions
  // overlay it (collab takes precedence on the same keys). Keeping
  // StarterKit's default config avoids the option-shape mismatch
  // between StarterKit versions.
  // CommentHighlight extension — emits an inline Decoration over
  // every range-pinned comment so the user sees an orange underline
  // at the anchored span. The extension is recreated per render only
  // when `highlights` changes (memoized below) so selection / IME
  // typing doesn't churn through plugin instantiation.
  const commentHighlightExt = useMemo(
    () => createCommentHighlightExtension(highlights, (commentId) => {
      // Click on a highlight → bring the matching comment into the
      // panel selection. The panel reads commentSelection.anchorPosition
      // to know which thread to scroll to.
      const target = highlights.find((h) => h.commentId === commentId);
      if (!target) return;
      setCommentSelection({
        kind: 'doc-body',
        documentId,
        anchorPosition: target.from,
      });
      setCommentPanelOpen(true);
    }),
    [highlights, documentId, setCommentSelection, setCommentPanelOpen],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: '내용을 입력하세요.',
        }),
        commentHighlightExt,
        ...collabExtensions,
      ],
      // ProseMirror tries to recreate state on the server during SSR
      // and produces a hydration mismatch warning; immediatelyRender
      // false defers to the client-side first effect.
      immediatelyRender: false,
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to, empty } = ed.state.selection;
        setSelRange(empty ? null : { from, to });
      },
    },
    [documentId, collabExtensions, commentHighlightExt],
  );

  const handleCommentSelection = () => {
    if (!selRange) return;
    setCommentSelection({
      kind: 'doc-body',
      documentId,
      anchorPosition: selRange.from,
      anchorLength: selRange.to - selRange.from,
    });
    setCommentPanelOpen(true);
  };

  if (!doc) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        문서 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className="border-b px-6 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <DocTitleEditor title={title} onTitleChange={onTitleChange} />
          <button
            type="button"
            onClick={handleCommentSelection}
            disabled={!selRange}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:hover:bg-transparent"
            style={{ color: 'var(--text-secondary)' }}
            title={selRange ? '선택한 부분에 코멘트 달기' : '먼저 텍스트를 선택하세요'}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            선택한 부분에 코멘트
          </button>
        </div>
        <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          collab status: {status}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-6 pb-16 md:pb-6">
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none focus:outline-none"
        />
      </div>
      {/* Mobile-only sticky toolbar (ADR 0022 v1.2 stage C). md:hidden
          inside the component itself; pb-16 above leaves room so the
          editor content doesn't end behind the toolbar. */}
      <MobileTiptapToolbar editor={editor} />
    </div>
  );
}

/**
 * Inline-editable title. Click switches to an input; Enter or blur
 * commits via onTitleChange; Escape reverts. Static h1 falls back
 * when no onTitleChange is supplied (read-only mount).
 */
interface DocTitleEditorProps {
  title: string;
  onTitleChange?: (next: string) => void;
}

function DocTitleEditor({ title, onTitleChange }: DocTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  // Sync draft on external title change (e.g. peer rename arrives
  // while we're not editing). Stays put while we're typing so a
  // simultaneous peer broadcast doesn't yank the cursor.
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  if (!onTitleChange) {
    return (
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h1>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    onTitleChange(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') {
            setEditing(false);
            setDraft(title);
          }
        }}
        className="w-full rounded-md border bg-transparent px-2 py-0.5 text-xl font-semibold outline-none"
        style={{
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded-md px-2 py-0.5 text-left text-xl font-semibold hover:bg-[var(--bg-hover)]"
      style={{ color: 'var(--text-primary)' }}
      title="클릭해서 제목 편집"
    >
      {title}
    </button>
  );
}

/**
 * Tiptap Extension that emits inline Decoration over every
 * range-pinned comment (Comment F.2). Each highlight gets a
 * `comment-highlight` class — the global stylesheet provides the
 * orange underline. Click handler dispatches via the supplied
 * onClick callback so the panel can scroll to the matched thread.
 *
 * Idempotent on highlight set churn: the plugin spec carries
 * highlights in plugin state via apply/init, but the React side
 * recreates the extension when `highlights` changes, which
 * triggers a fresh ProseMirror plugin replacement (Tiptap rebinds
 * the editor). Cheap because the plugin only stores a
 * DecorationSet — no persistent state across editor instances.
 */
function createCommentHighlightExtension(
  highlights: Array<{ commentId: string; from: number; to: number; resolved: boolean }>,
  onClick: (commentId: string) => void,
) {
  const pluginKey = new PluginKey('comment-highlight');
  return Extension.create({
    name: 'commentHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: pluginKey,
          props: {
            decorations(state) {
              const docSize = state.doc.content.size;
              const decos: Decoration[] = [];
              for (const h of highlights) {
                // Clamp to current doc bounds — the user may have
                // edited the doc since the comment was anchored,
                // shrinking it. Out-of-bound ranges are skipped
                // rather than crashing the plugin.
                const from = Math.max(0, Math.min(h.from, docSize));
                const to = Math.max(from, Math.min(h.to, docSize));
                if (to <= from) continue;
                decos.push(
                  Decoration.inline(from, to, {
                    class: h.resolved
                      ? 'comment-highlight comment-highlight-resolved'
                      : 'comment-highlight',
                    'data-comment-id': h.commentId,
                  }),
                );
              }
              return DecorationSet.create(state.doc, decos);
            },
            handleClick(view, _pos, event) {
              const target = event.target as HTMLElement | null;
              const span = target?.closest('[data-comment-id]') as HTMLElement | null;
              if (!span) return false;
              const commentId = span.getAttribute('data-comment-id');
              if (!commentId) return false;
              onClick(commentId);
              return true;
            },
          },
        }),
      ];
    },
  });
}
