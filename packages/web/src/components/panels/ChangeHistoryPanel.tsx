'use client';

/**
 * ChangeHistoryPanel — placeholder pending v0.7 audit-log re-instrumentation.
 *
 * The original (v0.5) implementation read `project.changelog`, an
 * IndexedDB Y.Doc field that the v0.6 cleanup removed. The
 * server-canonical replacement lives in the backend audit_log
 * table (V22) — wiring this panel to `/api/v1/projects/:id/audit-log`
 * is a separate phase from the dock restoration work, so the panel
 * keeps its dock slot but renders a transparent placeholder until
 * the read path lands.
 */

import { History } from 'lucide-react';

interface ChangeHistoryPanelProps {
  onClose?: () => void;
  isPanel?: boolean;
}

export default function ChangeHistoryPanel({ onClose }: ChangeHistoryPanelProps) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"
      style={{ color: 'var(--text-secondary)' }}
    >
      <History className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
      <p>변경 이력은 server-canonical audit log 와 다시 연결 중입니다.</p>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        (v0.7 phase, ADR 0034)
      </p>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          닫기
        </button>
      ) : null}
    </div>
  );
}
