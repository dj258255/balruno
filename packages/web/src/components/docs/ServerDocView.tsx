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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { History, Loader2, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import DocHistoryPanel from './DocHistoryPanel';
import { useDocCollab } from '@/hooks/useDocCollab';
import { useCommentSelectionStore } from '@/stores/commentSelectionStore';
import { humanizeUploadError, listCommentsForDoc, resolveMediaUrl, uploadAttachment } from '@/lib/backend';
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
  const t = useTranslations();
  const { extensions: collabExtensions, doc, status } = useDocCollab(documentId);

  // Tracks the user's current text selection inside the editor —
  // used to enable the "comment on selection" header button (Comment
  // F.2). When the selection is empty, the button is disabled and
  // creating a comment falls back to doc-level (anchorPosition = null).
  const [selRange, setSelRange] = useState<{ from: number; to: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Doc body right-click menu — overrides the browser default with our
  // own (Comment / History) per Notion / Linear convention.
  const [bodyContextMenu, setBodyContextMenu] = useState<
    { x: number; y: number } | null
  >(null);
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
  //
  // CommentHighlight: stable extension created once per documentId.
  // Decorations are stored inside the ProseMirror plugin state and
  // refreshed via a meta transaction when `highlights` changes —
  // recreating the extension would force useEditor to rebuild the
  // editor and bounce the user's cursor / IME state on every peer
  // comment broadcast.
  const onHighlightClickRef = useRef<(commentId: string) => void>(() => {});
  onHighlightClickRef.current = (commentId: string) => {
    const target = highlights.find((h) => h.commentId === commentId);
    if (!target) return;
    setCommentSelection({
      kind: 'doc-body',
      documentId,
      anchorPosition: target.from,
    });
    setCommentPanelOpen(true);
  };
  const commentHighlightExt = useMemo(
    () => createCommentHighlightExtension(onHighlightClickRef),
    // Stable per documentId — doc swap is the only legitimate
    // reason to rebuild the plugin (decoration set is doc-bound).
    [documentId],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: '내용을 입력하세요.',
        }),
        // Inline image — uploaded via uploadAttachment (Phase D).
        // inline=true keeps img inside paragraph nodes so cursor /
        // typing flow stays natural; allowBase64=false forces the
        // img src to be a real URL (no inline base64 bombs that
        // would skip the server-side validation pipe).
        Image.configure({ inline: true, allowBase64: false }),
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
      editorProps: {
        // Drop / paste handlers — when the dropped/pasted DataTransfer
        // contains image files, intercept and route through
        // uploadAttachment so the bytes hit the backend pipeline
        // (size cap + magic-byte + workspace quota) before reaching
        // the editor. ProseMirror's default handlers would otherwise
        // accept arbitrary base64 / blob URLs.
        handleDrop(view, event) {
          const items = event.dataTransfer?.files;
          if (!items || items.length === 0) return false;
          const images = Array.from(items).filter((f) => f.type.startsWith('image/'));
          if (images.length === 0) return false;
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const insertAt = coords?.pos ?? view.state.selection.from;
          void insertImagesAt(images, insertAt);
          return true;
        },
        handlePaste(_view, event) {
          const items = event.clipboardData?.files;
          if (!items || items.length === 0) return false;
          const images = Array.from(items).filter((f) => f.type.startsWith('image/'));
          if (images.length === 0) return false;
          event.preventDefault();
          void insertImagesAt(images, null);
          return true;
        },
      },
    },
    [documentId, collabExtensions, commentHighlightExt],
  );

  // Bound image-insert helper used by drop / paste / toolbar — uploads
  // each file sequentially (so quota errors stop the chain rather than
  // half-applying) and inserts the resulting <img> at the requested
  // position (or at the current selection when null).
  const insertImagesAt = async (
    files: File[],
    pos: number | null,
  ): Promise<void> => {
    if (!editor) return;
    let cursor = pos;
    for (const file of files) {
      try {
        // Pass the doc ref so the orphan-cleanup hook (project cascade
        // for now; doc-body diff later) can free the blob when this doc
        // is deleted.
        const { url } = await uploadAttachment(projectId, file, {
          kind: 'doc',
          id: documentId,
        });
        const resolved = resolveMediaUrl(url) ?? url;
        const chain = editor.chain().focus();
        const at = cursor ?? editor.state.selection.from;
        chain.insertContentAt(at, {
          type: 'image',
          attrs: { src: resolved, alt: file.name },
        }).run();
        cursor = null; // subsequent images go at the live cursor
      } catch (e) {
        toast.error(humanizeUploadError(e, t, { kind: 'image', maxLabel: '50MB' }));
        return;
      }
    }
  };

  // Push the latest highlight set into the plugin state via a meta
  // transaction. The plugin's `apply` reads tr.getMeta(KEY) to swap
  // its DecorationSet — the editor / cursor / IME stays put.
  useEffect(() => {
    if (!editor) return;
    const view = editor.view;
    const tr = view.state.tr.setMeta(COMMENT_HIGHLIGHT_META, highlights);
    view.dispatch(tr);
  }, [editor, highlights]);

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
          <div className="flex items-center gap-1">
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
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}
              title="페이지 변경 이력"
            >
              <History className="h-3.5 w-3.5" />
              변경 이력
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          collab status: {status}
        </p>
      </header>
      <div
        className="flex-1 overflow-y-auto p-6 pb-16 md:pb-6"
        onContextMenu={(e) => {
          // Override browser default menu (spell-check, dictionary,
          // etc.) with our doc-aware menu — comment + history. Same
          // pattern Notion / Linear use for their doc bodies. Loses
          // OS-level surfaces (translate, look up) but matches the
          // app's own ergonomics.
          e.preventDefault();
          setBodyContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none focus:outline-none"
        />
      </div>

      {bodyContextMenu && (
        <DocBodyContextMenu
          x={bodyContextMenu.x}
          y={bodyContextMenu.y}
          hasSelection={Boolean(selRange)}
          onAddComment={() => {
            handleCommentSelection();
            setBodyContextMenu(null);
          }}
          onShowHistory={() => {
            setHistoryOpen(true);
            setBodyContextMenu(null);
          }}
          onClose={() => setBodyContextMenu(null)}
        />
      )}
      {/* Mobile-only sticky toolbar (ADR 0022 v1.2 stage C). md:hidden
          inside the component itself; pb-16 above leaves room so the
          editor content doesn't end behind the toolbar. */}
      <MobileTiptapToolbar editor={editor} />

      {historyOpen && (
        <DocHistoryPanel
          docId={documentId}
          docTitle={title}
          onClose={() => setHistoryOpen(false)}
        />
      )}
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
 * Meta key used by the surrounding ServerDocView to push a fresh
 * highlight set into the plugin without recreating the extension.
 * Exported via module scope so the dispatcher and the plugin's
 * `apply` use the exact same string instance.
 */
const COMMENT_HIGHLIGHT_META = 'comment-highlight/set';

interface CommentHighlight {
  commentId: string;
  from: number;
  to: number;
  resolved: boolean;
}

/**
 * Tiptap Extension that emits inline Decoration over every
 * range-pinned comment (Comment F.2). Each highlight gets a
 * `comment-highlight` class — the global stylesheet provides the
 * orange underline. Click handler dispatches via the ref-held
 * callback so the panel can scroll to the matched thread.
 *
 * Stable across highlight churn: the highlight set lives in plugin
 * state and is mapped through document changes via DecorationSet.map
 * so concurrent edits don't drift the underlines. Updating the set
 * is a single meta-transaction (no editor recreate) — the user's
 * cursor / IME state is preserved when peers add/edit/delete
 * comments.
 */
function createCommentHighlightExtension(
  onClickRef: { current: (commentId: string) => void },
) {
  const pluginKey = new PluginKey<DecorationSet>('comment-highlight');
  return Extension.create({
    name: 'commentHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: pluginKey,
          state: {
            init: () => DecorationSet.empty,
            apply(tr, oldSet) {
              const incoming = tr.getMeta(COMMENT_HIGHLIGHT_META) as
                | CommentHighlight[]
                | undefined;
              if (incoming) {
                return buildDecorationSet(tr.doc, incoming);
              }
              // Map existing decorations through doc changes so the
              // underline tracks edited text (Tiptap's standard
              // pattern for range-anchored decoration plugins).
              return oldSet.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations(state) {
              return pluginKey.getState(state) ?? DecorationSet.empty;
            },
            handleClick(view, _pos, event) {
              const target = event.target as HTMLElement | null;
              const span = target?.closest('[data-comment-id]') as HTMLElement | null;
              if (!span) return false;
              const commentId = span.getAttribute('data-comment-id');
              if (!commentId) return false;
              onClickRef.current(commentId);
              return true;
            },
          },
        }),
      ];
    },
  });
}

function buildDecorationSet(
  doc: import('@tiptap/pm/model').Node,
  highlights: CommentHighlight[],
): DecorationSet {
  const docSize = doc.content.size;
  const decos: Decoration[] = [];
  for (const h of highlights) {
    // Clamp to current doc bounds — the user may have edited the
    // doc since the comment was anchored, shrinking it. Out-of-
    // bound ranges are skipped rather than crashing the plugin.
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
  return DecorationSet.create(doc, decos);
}

/**
 * Right-click menu for the doc body. Mirrors the structure of the
 * sheet's CellContextMenu (fixed position, viewport-clamped, click-
 * outside / Escape close) so both surfaces feel the same.
 */
function DocBodyContextMenu({
  x,
  y,
  hasSelection,
  onAddComment,
  onShowHistory,
  onClose,
}: {
  x: number;
  y: number;
  hasSelection: boolean;
  onAddComment: () => void;
  onShowHistory: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Clamp to viewport — same logic as CellContextMenu's effect.
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      ref.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      ref.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    hint?: string;
    divider?: boolean;
  }> = [
    {
      label: t('contextMenu.addComment'),
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: onAddComment,
      disabled: !hasSelection,
      hint: hasSelection ? undefined : t('docContext.selectFirst'),
      divider: true,
    },
    {
      label: t('docContext.showHistory'),
      icon: <History className="w-4 h-4" />,
      onClick: onShowHistory,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[200px] py-1 rounded-lg shadow-lg"
      style={{
        left: x,
        top: y,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {items.map((it, i) => (
        <div key={i}>
          <button
            onClick={() => {
              if (!it.disabled) it.onClick();
            }}
            disabled={it.disabled}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
            style={{
              color: it.disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
              cursor: it.disabled ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!it.disabled) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title={it.hint}
          >
            <span style={{ opacity: it.disabled ? 0.5 : 1 }}>{it.icon}</span>
            <span className="flex-1 text-left">{it.label}</span>
          </button>
          {it.divider && (
            <div
              className="my-1 mx-2"
              style={{ height: 1, background: 'var(--border-primary)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
