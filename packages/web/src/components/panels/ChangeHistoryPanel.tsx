/**
 * ChangeHistoryPanel — 
 *
 * 모든 프로젝트의 cell 변경 이력을 시간 역순으로 보여준다.
 * - 행 클릭 → 해당 시트/행으로 점프 (setCurrentSheet + focus-row 이벤트)
 * - "왜?" 버튼 → reason 편집 (updateChangelogReason)
 * - 필터: 프로젝트 / 시트 / 사용자
 */

import { useMemo, useState } from 'react';
import { Clock, ArrowRight, X, MessageSquare } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { getProjectDoc, updateChangelogReason } from '@/lib/ydoc';
import type { ChangeEntry, CellValue } from '@/types';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

interface EnrichedEntry extends ChangeEntry {
  projectId: string;
  projectName: string;
  sheetName: string;
  columnName: string;
}

function formatTime(t: ReturnType<typeof useTranslations>, ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return t('changeHistory.justNow');
  if (diff < 3_600_000) return t('changeHistory.minutesAgo', { m: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('changeHistory.hoursAgo', { h: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t('changeHistory.daysAgo', { d: Math.floor(diff / 86_400_000) });
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatValue(t: ReturnType<typeof useTranslations>, v: CellValue): string {
  if (v === null || v === '') return t('changeHistory.emptyValue');
  return String(v);
}

import { NamedSnapshotPanel } from '@/components/changelog/NamedSnapshotPanel';

export default function ChangeHistoryPanel({ onClose }: Props) {
  const t = useTranslations();
  const projects = useProjectStore((s) => s.projects);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);

  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [tab, setTab] = useState<'changes' | 'snapshots'>('changes');
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // 모든 프로젝트의 changelog 를 한 배열로 (enriched)
  const allEntries: EnrichedEntry[] = useMemo(() => {
    const out: EnrichedEntry[] = [];
    for (const project of projects) {
      const entries = project.changelog ?? [];
      for (const e of entries) {
        const sheet = project.sheets.find((s) => s.id === e.sheetId);
        const column = sheet?.columns.find((c) => c.id === e.columnId);
        out.push({
          ...e,
          projectId: project.id,
          projectName: project.name,
          sheetName: sheet?.name ?? t('changeHistory.deletedSheet'),
          columnName: column?.name ?? t('changeHistory.deletedColumn'),
        });
      }
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [projects]);

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      if (filterProject !== 'all' && e.projectId !== filterProject) return false;
      if (filterUser !== 'all' && e.userName !== filterUser) return false;
      return true;
    });
  }, [allEntries, filterProject, filterUser]);

  const users = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) set.add(e.userName);
    return Array.from(set);
  }, [allEntries]);

  const jumpTo = (entry: EnrichedEntry) => {
    setCurrentDoc(null);
    setCurrentSheet(entry.sheetId);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('balruno:focus-row', {
          detail: { sheetId: entry.sheetId, rowId: entry.rowId, columnId: entry.columnId },
        })
      );
    }, 50);
  };

  const startEditReason = (entry: EnrichedEntry) => {
    setEditingReasonId(entry.id);
    setReasonDraft(entry.reason ?? '');
  };

  const saveReason = (entry: EnrichedEntry) => {
    const doc = getProjectDoc(entry.projectId);
    updateChangelogReason(doc, entry.id, reasonDraft.trim());
    setEditingReasonId(null);
    setReasonDraft('');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('changeHistory.header')}
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {filtered.length} / {allEntries.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={t('changeHistory.closeAria')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-3 pt-2 border-b shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {(['changes', 'snapshots'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-3 py-1.5 text-xs rounded-t-md font-medium border-b-2 transition-colors"
            style={{
              color: tab === id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: tab === id ? 'var(--accent)' : 'transparent',
            }}
          >
            {id === 'changes' ? t('changeHistory.tabChanges') : t('changeHistory.tabSnapshots')}
          </button>
        ))}
      </div>

      {tab === 'snapshots' && currentProjectId ? (
        <NamedSnapshotPanel
          projectId={currentProjectId}
          capturePayload={() => projects.find((p) => p.id === currentProjectId) ?? null}
          onRestore={(payload) => {
            // eslint-disable-next-line no-console
            console.warn('[snapshots] restore not yet wired into projectStore', payload);
          }}
        />
      ) : tab === 'snapshots' ? (
        <div className="flex-1 flex items-center justify-center p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('changeHistory.noProjectForSnapshot')}
        </div>
      ) : (
      <>
      {/* Filters */}
      <div
        className="flex items-center gap-2 px-5 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-xs px-2 py-1 rounded-md border focus:outline-none"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="all">{t('changeHistory.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="text-xs px-2 py-1 rounded-md border focus:outline-none"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="all">{t('changeHistory.allUsers')}</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full px-8">
            <div className="text-center">
              <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('changeHistory.noChanges')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('changeHistory.noChangesHelp')}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
            {filtered.map((entry) => {
              const isEditing = editingReasonId === entry.id;
              return (
                <li
                  key={entry.id}
                  className="px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-xs font-medium"
                          style={{ color: 'var(--accent)' }}
                        >
                          {entry.userName}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          · {formatTime(t, entry.timestamp)}
                        </span>
                        <button
                          onClick={() => jumpTo(entry)}
                          className="text-xs hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                          title={t('changeHistory.jumpToCell')}
                        >
                          {entry.projectName} / {entry.sheetName} / {entry.columnName}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-tertiary)',
                            textDecoration: 'line-through',
                          }}
                        >
                          {formatValue(t, entry.before)}
                        </span>
                        <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        <span
                          className="px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: 'var(--accent)',
                          }}
                        >
                          {formatValue(t, entry.after)}
                        </span>
                      </div>

                      {/* Reason */}
                      {isEditing ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={reasonDraft}
                            onChange={(e) => setReasonDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveReason(entry);
                              if (e.key === 'Escape') {
                                setEditingReasonId(null);
                                setReasonDraft('');
                              }
                            }}
                            autoFocus
                            placeholder={t('changeHistory.reasonPlaceholder')}
                            className="flex-1 px-2 py-1 text-xs rounded border focus:outline-none"
                            style={{
                              background: 'var(--bg-secondary)',
                              borderColor: 'var(--accent)',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <button
                            onClick={() => saveReason(entry)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: 'var(--accent)', color: 'white' }}
                          >
                            {t('changeHistory.saveLabel')}
                          </button>
                        </div>
                      ) : entry.reason ? (
                        <button
                          onClick={() => startEditReason(entry)}
                          className="mt-1 text-xs text-left italic hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          &ldquo;{entry.reason}&rdquo;
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditReason(entry)}
                          className="mt-1 text-xs inline-flex items-center gap-1 opacity-40 hover:opacity-100"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {t('changeHistory.addReason')}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </>
      )}
    </div>
  );
}
