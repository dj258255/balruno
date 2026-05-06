'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DangerConfirmDialogProps {
  open: boolean;
  /** Modal heading. Should be a question. */
  title: string;
  /** Body text — ideally explaining what gets deleted and the grace period. */
  description: string;
  /**
   * The exact word the user must type to enable the confirm button.
   * Stripe / GitHub / Linear all use this friction step on destructive
   * mutations; surfacing the workspace name here forces a deliberate
   * action instead of a reflex click.
   */
  confirmWord: string;
  /** Action label on the destructive button (e.g., "영구 삭제"). */
  confirmLabel: string;
  /** Cancel label, defaults to a generic "취소" via i18n at the call site. */
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Self-contained destructive-confirmation modal. Built without Radix or
 * shadcn/ui to keep the dependency surface small — npm install hangs in
 * this monorepo are an active operational concern, so until we batch a
 * dedicated UI primitives migration we hand-roll modals to match the
 * existing {@code MemberManagementModal} pattern.
 *
 * Behaviour parity with the industry reference (Stripe/GitHub/Linear):
 *   - Inert until the user types the confirm word verbatim
 *   - Esc + outside-click + cancel button all dismiss
 *   - The destructive action is the only red button, on the right
 *   - Trapping focus is intentionally NOT implemented yet — when we
 *     adopt Radix we'll get accessible focus trap + scroll lock for free
 */
export function DangerConfirmDialog({
  open,
  title,
  description,
  confirmWord,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: DangerConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped('');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    // Focus the input so the user can immediately start typing the
    // confirm word without an extra mouse click.
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const enabled = typed.trim() === confirmWord && !busy;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="danger-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border shadow-xl"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(220, 38, 38, 0.12)' }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h2
                id="danger-confirm-title"
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50"
            aria-label={cancelLabel}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            placeholder={confirmWord}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            style={{
              borderColor: 'var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md disabled:opacity-50 hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!enabled}
            className="px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50"
            style={{ background: '#dc2626' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
