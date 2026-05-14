'use client';

/**
 * Mounts the Cmd+K palette globally + binds the keyboard shortcut.
 *
 * Lives in app/layout.tsx so the palette is reachable from every
 * page (workspace picker, project page, settings, ...). The palette
 * body is dynamic-imported so it stays out of the first-paint bundle
 * — the chunk only loads after the user hits Cmd+K once.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CommandPalette = dynamic(
  () => import('./CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K elsewhere. Don't fire when the user
      // is in a contentEditable / Tiptap mention (they'd lose their
      // typing context) — heuristic: open if the active element
      // isn't a form input that already handles cmd+k itself.
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      e.preventDefault();
      setMounted(true);
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!mounted) return null;
  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}
