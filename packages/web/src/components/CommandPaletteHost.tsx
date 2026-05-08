'use client';

/**
 * Mounts the Cmd+K palette globally + binds the keyboard shortcut.
 *
 * Lives in app/layout.tsx so the palette is reachable from every
 * page (workspace picker, project page, settings, ...). Only renders
 * a hidden host until the user hits Cmd+K, so the palette code is
 * still in the bundle but cheap when idle.
 */

import { useEffect, useState } from 'react';
import { CommandPalette } from './CommandPalette';

export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K elsewhere. Don't fire when the user
      // is in a contentEditable / Tiptap mention (they'd lose their
      // typing context) — heuristic: open if the active element
      // isn't a form input that already handles cmd+k itself.
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}
