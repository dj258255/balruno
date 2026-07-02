'use client';

/**
 * GDPR account self-service — data export + account delete.
 *
 * Same component serves both the legacy `/settings/account` page
 * route (no onClose prop, renders as full-page <main>) and the
 * Notion/Linear-style centered modal triggered from the workspace
 * switcher (onClose prop, portal-based overlay). Single source of
 * truth so the form behaviour (DELETE-typing confirm, soft-delete
 * cascade, owner-of-only-workspace 409 handling) doesn't drift
 * across two surfaces.
 */

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, Loader2, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { deleteMyAccount, downloadDataExport } from '@/lib/backend';
import ProfileSettingsSection from './ProfileSettingsSection';

interface AccountSettingsClientProps {
  /**
   * When provided, render as a centered overlay modal (portal to
   * document.body). Without it, render as the legacy full-page
   * layout the `/settings/account` route uses.
   */
  onClose?: () => void;
  /**
   * When true, skip the shell entirely (no portal, no overlay, no
   * page <main>, no header X) and render only the body content —
   * used by SettingsHub which provides its own frame + close button.
   */
  embedded?: boolean;
}

export default function AccountSettingsClient({
  onClose,
  embedded = false,
}: AccountSettingsClientProps = {}) {
  const t = useTranslations('accountSettings');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [exporting, setExporting] = useState(false);
  const isModal = Boolean(onClose);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadDataExport();
      toast.success(t('exportSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success(t('deleteSuccess'));
      window.location.href = '/login';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return wrapShell(
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('subtitle')}
        </p>
      </header>

      {/* Profile (display name + avatar) — Phase C. Self-contained
          state + uses backendAuthStore as the source of truth so the
          sidebar avatar refreshes the instant we save. */}
      <ProfileSettingsSection />

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: '#dc2626', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: '#dc2626' }}>
          <AlertTriangle className="h-4 w-4" />
          {t('dangerHeading')}
        </h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('dangerExplain')}
        </p>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('confirmTypeDelete')}
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={t('deletePlaceholder')}
          className="mb-2 w-full rounded border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border-primary)', background: 'transparent', color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || confirmText !== 'DELETE'}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          {t('deleteButton')}
        </button>
      </section>

      {/* GDPR Article 20 — small inline link, not a prominent
          card. The endpoint is required for compliance with EU
          users; the UI just provides a self-service path. */}
      <div className="flex items-center justify-end pt-2 text-xs">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1 hover:underline disabled:opacity-50"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {t('exportLink')}
        </button>
      </div>
    </div>,
    { isModal, onClose, embedded },
  );
}

function wrapShell(
  body: ReactNode,
  { isModal, onClose, embedded }: { isModal: boolean; onClose?: () => void; embedded?: boolean },
): ReactNode {
  // Embedded (SettingsHub pane) — the hub owns the frame; render bare body.
  if (embedded) return body;
  if (!isModal) {
    return <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">{body}</main>;
  }
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-hover)]" aria-label="close">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{body}</div>
      </div>
    </div>,
    document.body,
  );
}
