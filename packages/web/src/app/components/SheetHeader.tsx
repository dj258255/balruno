import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Sheet } from '@/types';
import PresenceIndicator from '@/components/PresenceIndicator';
import { useProjectStore } from '@/stores/projectStore';

interface SheetHeaderProps {
  sheet: Sheet;
  /** Drives the live-collaborators chrome on the right. Optional —
   *  passing null hides the indicator (useful for legacy local-mode
   *  callers that don't have a server-canonical project id). */
  projectId?: string | null;
}

export default function SheetHeader({
  sheet,
  projectId = null,
}: SheetHeaderProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);

  // Inline rename — click the title to edit, blur / Enter saves, Escape
  // cancels. Same pattern as Linear / Notion: keep the read-only state
  // visible by default so the page doesn't constantly look like a form.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(sheet.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the draft fresh when the active sheet changes (tab swap) — the
  // editing state itself resets via the conditional render so any
  // half-edited input is dropped on swap.
  useEffect(() => {
    setDraftName(sheet.name);
    setEditing(false);
  }, [sheet.id, sheet.name]);

  // Auto-focus + select-all when entering edit mode so the user can
  // type over the existing name without an extra Cmd-A.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draftName.trim();
    if (next && next !== sheet.name && projectId) {
      updateSheet(projectId, sheet.id, { name: next });
    } else {
      setDraftName(sheet.name);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(sheet.name);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-5 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancel();
                  }
                }}
                maxLength={120}
                className="text-base sm:text-lg lg:text-xl font-bold bg-transparent outline-none border-b"
                style={{
                  color: 'var(--text-primary)',
                  borderColor: 'var(--accent)',
                  minWidth: 120,
                }}
              />
            ) : (
              <h2
                className="text-base sm:text-lg lg:text-xl font-bold cursor-text rounded px-1 -mx-1 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => projectId && setEditing(true)}
                title={projectId ? t('sheet.clickToRename') : undefined}
              >
                {sheet.name}
              </h2>
            )}
            {sheet.exportClassName && (
              <span
                className="text-xs sm:text-sm px-2 py-0.5 rounded"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)'
                }}
                title={t('sheet.exportClassName')}
              >
                {sheet.exportClassName}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {t('sheet.rowCount', { count: sheet.rows.length })} · {t('sheet.colCount', { count: sheet.columns.length })}
          </p>
        </div>
      </div>
      {projectId && <PresenceIndicator projectId={projectId} />}
    </div>
  );
}
