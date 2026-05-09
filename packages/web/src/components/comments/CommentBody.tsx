/**
 * CommentBody — read-only renderer for a Tiptap comment doc.
 *
 * Walks the JSON tree once and emits inline `text` + `@mention chip`
 * spans. Sharing this between CellCommentPanel / DocCommentPanel /
 * CommentsPanel / InboxBell keeps mention chips visually consistent
 * with the composer (`MentionEditor` outputs the same
 * `.balruno-mention` class via the Mention extension's HTMLAttributes).
 *
 * We deliberately don't spin up a full Tiptap read-only editor for
 * this — comment bodies are tiny (one paragraph, no marks beyond
 * mention) so the JSX walker is ~50 LOC and renders without the
 * editor mount cost (200ms+ on first comment).
 */

import { Fragment, type ReactNode } from 'react';
import { resolveMediaUrl } from '@/lib/backend';

interface CommentBodyProps {
  body: unknown;
  /** Optional fallback when the body is empty / malformed. */
  fallback?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CommentBody({ body, fallback, className, style }: CommentBodyProps) {
  const nodes = renderNode(body, 0);
  if (nodes.length === 0) return <>{fallback ?? null}</>;
  return (
    <p className={className} style={style}>
      {nodes}
    </p>
  );
}

function renderNode(node: unknown, key: number): ReactNode[] {
  if (!node || typeof node !== 'object') return [];
  const obj = node as {
    type?: string;
    text?: unknown;
    attrs?: { id?: unknown; label?: unknown };
    content?: unknown;
  };

  if (obj.type === 'text' && typeof obj.text === 'string') {
    return [<Fragment key={key}>{obj.text}</Fragment>];
  }

  if (obj.type === 'mention') {
    const label = typeof obj.attrs?.label === 'string'
      ? obj.attrs.label
      : typeof obj.attrs?.id === 'string'
        ? obj.attrs.id
        : '';
    if (!label) return [];
    return [
      <span key={key} className="balruno-mention">
        @{label}
      </span>,
    ];
  }

  if (obj.type === 'image') {
    const attrs = obj.attrs as { src?: unknown; alt?: unknown } | undefined;
    const src = typeof attrs?.src === 'string' ? attrs.src : null;
    if (!src) return [];
    const alt = typeof attrs?.alt === 'string' ? attrs.alt : '';
    return [
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        src={resolveMediaUrl(src) ?? src}
        alt={alt}
        className="my-1 inline-block max-h-48 max-w-full rounded border align-middle"
        style={{ borderColor: 'var(--border-primary)' }}
      />,
    ];
  }

  if (Array.isArray(obj.content)) {
    const out: ReactNode[] = [];
    obj.content.forEach((child, idx) => {
      out.push(...renderNode(child, key * 100 + idx + 1));
    });
    if (obj.type === 'paragraph') {
      // Tiptap paragraphs are line-level; preserve break between
      // sibling paragraphs without rendering an extra <p> nest
      // (CommentBody itself wraps in a single <p>).
      out.push(<Fragment key={`br-${key}`}> </Fragment>);
    }
    return out;
  }

  return [];
}
