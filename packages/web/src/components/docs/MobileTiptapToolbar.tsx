'use client';

/**
 * Sticky bottom Tiptap toolbar for mobile (ADR 0022 v1.2 stage C).
 *
 * Tiptap's StarterKit provides headings, bold/italic, lists, code,
 * etc. but exposes no UI — desktop users get the marks via keyboard
 * shortcuts (Cmd+B, etc.). Touch devices have no comparable
 * shortcuts, so an always-visible toolbar at the bottom of the
 * viewport gives equal access.
 *
 * Layout:
 *   - fixed inset-x-0 bottom-0, single horizontal row of 44-px
 *     buttons (Apple HIG comfortable size).
 *   - safe-area-inset-bottom padding so iPhone home-bar doesn't
 *     overlap on notched devices.
 *   - md:hidden so desktop shows nothing — keyboard shortcuts +
 *     future BubbleMenu cover that surface.
 *
 * Only the most-used actions land here (bold / italic / H1 / list /
 * undo). The full kitchen-sink toolbar (link, code block, image,
 * etc.) is the BubbleMenu's job in stage C.2.
 */

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  List,
  ListOrdered,
  Undo,
  Redo,
} from 'lucide-react';

interface MobileTiptapToolbarProps {
  editor: Editor | null;
}

export function MobileTiptapToolbar({ editor }: MobileTiptapToolbarProps) {
  if (!editor) return null;

  const buttons = [
    {
      icon: <Bold className="h-5 w-5" />,
      label: 'bold',
      active: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: <Italic className="h-5 w-5" />,
      label: 'italic',
      active: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: <Heading1 className="h-5 w-5" />,
      label: 'h1',
      active: editor.isActive('heading', { level: 1 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      icon: <List className="h-5 w-5" />,
      label: 'ul',
      active: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: <ListOrdered className="h-5 w-5" />,
      label: 'ol',
      active: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: <Undo className="h-5 w-5" />,
      label: 'undo',
      active: false,
      onClick: () => editor.chain().focus().undo().run(),
    },
    {
      icon: <Redo className="h-5 w-5" />,
      label: 'redo',
      active: false,
      onClick: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t md:hidden"
      style={{
        borderColor: 'var(--border-primary)',
        background: 'var(--bg-primary)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.onClick}
          aria-label={b.label}
          aria-pressed={b.active}
          className="inline-flex h-11 w-11 items-center justify-center rounded transition-colors"
          style={{
            color: b.active ? 'var(--accent)' : 'var(--text-secondary)',
            background: b.active ? 'var(--accent-light)' : 'transparent',
          }}
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}
