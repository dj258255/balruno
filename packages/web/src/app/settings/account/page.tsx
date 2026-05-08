'use client';

/**
 * GDPR self-service page (right to data portability + right to be
 * forgotten). Two sections:
 *   - Data export: downloads the user's JSON dump.
 *   - Account deletion: confirm-by-typing "DELETE" before sending.
 *     Backend rejects without that exact string.
 *
 * The deletion flow soft-deletes; sole-owner-of-shared-workspace
 * returns 409 with the workspace list, surfaced as a toast.
 */

import { useState } from 'react';
import { Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadDataExport,
  deleteMyAccount,
} from '@/lib/backend';

export default function AccountSettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadDataExport();
      toast.success('데이터 export 다운로드');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'export 실패');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || confirmText !== 'DELETE') return;
    if (!window.confirm('정말로 계정을 삭제할까요? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success('계정이 삭제되었습니다.');
      window.location.href = '/';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          계정
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          GDPR 권리 — 데이터 내려받기 + 계정 삭제. 둘 다 자체 서비스로 처리합니다.
        </p>
      </header>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <Download className="h-4 w-4" />
          데이터 export
        </h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          유저 정보 + 멤버십 + 본인이 멤버인 workspace / project (JSONB 스냅샷) + 본인 코멘트 + 알림 설정 + Web Push 구독 정보를 JSON 한 파일로 다운로드합니다.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        >
          {exporting ? <Loader2 className="inline h-3 w-3 animate-spin" /> : '내 데이터 다운로드'}
        </button>
      </section>

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
    </div>
  );
}
