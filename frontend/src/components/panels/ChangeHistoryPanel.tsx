'use client';

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

interface Props {
  onClose: () => void;
}

interface EnrichedEntry extends ChangeEntry {
  projectId: string;
  projectName: string;
  sheetName: string;
  columnName: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatValue(v: CellValue): string {
  if (v === null || v === '') return '(빈 값)';
  return String(v);
}

export default function ChangeHistoryPanel({ onClose }: Props) {
  const projects = useProjectStore((s) => s.projects);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);

  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

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
          sheetName: sheet?.name ?? '(삭제된 시트)',
          columnName: column?.name ?? '(삭제된 컬럼)',
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
            변경 이력
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {filtered.length} / {allEntries.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
          <option value="all">전체 프로젝트</option>
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
          <option value="all">전체 사용자</option>
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
                변경 이력이 없습니다
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                셀 값을 수정하면 자동으로 기록됩니다
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
                          · {formatTime(entry.timestamp)}
                        </span>
                        <button
                          onClick={() => jumpTo(entry)}
                          className="text-xs hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                          title="해당 셀로 이동"
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
                          {formatValue(entry.before)}
                        </span>
                        <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        <span
                          className="px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: 'var(--accent)',
                          }}
                        >
                          {formatValue(entry.after)}
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
                            placeholder="왜 이렇게 바꿨나요?"
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
                            저장
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
                          이유 추가
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
    </div>
  );
}
