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

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Loader2 } from 'lucide-react';
import { useDocCollab } from '@/hooks/useDocCollab';

interface ServerDocViewProps {
  documentId: string;
  /** The doc tree leaf's name — rendered as a read-only header so
   *  the user has visual context. Edits flow through tree.rename in
   *  the sidebar. */
  title: string;
}

export function ServerDocView({ documentId, title }: ServerDocViewProps) {
  const { extensions: collabExtensions, doc, status } = useDocCollab(documentId);

  // Tiptap editor — StarterKit + Placeholder + collab extensions.
  // The Tiptap @collaboration extension manages undo via Y.Doc, but
  // StarterKit's bundled history is harmless when collab extensions
  // overlay it (collab takes precedence on the same keys). Keeping
  // StarterKit's default config avoids the option-shape mismatch
  // between StarterKit versions.
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: '내용을 입력하세요.',
        }),
        ...collabExtensions,
      ],
      // ProseMirror tries to recreate state on the server during SSR
      // and produces a hydration mismatch warning; immediatelyRender
      // false defers to the client-side first effect.
      immediatelyRender: false,
    },
    [documentId, collabExtensions],
  );

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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          collab status: {status}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none focus:outline-none"
        />
      </div>
    </div>
  );
}
