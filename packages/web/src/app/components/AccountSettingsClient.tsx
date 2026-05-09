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
import { deleteMyAccount, downloadDataExport } from '@/lib/backend';

interface AccountSettingsClientProps {
  /**
   * When provided, render as a centered overlay modal (portal to
   * document.body). Without it, render as the legacy full-page
   * layout the `/settings/account` route uses.
   */
  onClose?: () => void;
}

export default function AccountSettingsClient({ onClose }: AccountSettingsClientProps = {}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [exporting, setExporting] = useState(false);
  const isModal = Boolean(onClose);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadDataExport();
      toast.success('내 데이터 JSON 을 내려받았습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '데이터 내려받기 실패');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success('계정이 삭제되었습니다.');
      window.location.href = '/login';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계정 삭제 실패');
    } finally {
      setDeleting(false);
    }
  };

  return wrapShell(
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          계정
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          계정 삭제는 soft-delete 입니다. 다른 멤버가 있는 워크스페이스는
          먼저 소유자 이양이 필요합니다.
        </p>
      </header>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: '#dc2626', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: '#dc2626' }}>
          <AlertTriangle className="h-4 w-4" />
          계정 삭제 (위험)
        </h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          본인 user 행을 soft-delete 하고, 본인이 *유일한 owner* 인 workspace 도 함께 soft-delete 합니다. 다른 멤버가 있는 workspace 는 먼저 owner 권한을 이양해야 합니다.
        </p>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          확인을 위해 아래에 <code>DELETE</code> 를 입력하세요.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
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
          계정 삭제
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
          내 데이터 내려받기 (GDPR)
        </button>
      </div>
    </div>,
    { isModal, onClose },
  );
}

function wrapShell(
  body: ReactNode,
  { isModal, onClose }: { isModal: boolean; onClose?: () => void },
): ReactNode {
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
