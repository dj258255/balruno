'use client';

/**
 * 중복 프로젝트 정리 모달.
 * 감지된 그룹 표시 → "정리 실행" → 그룹마다 canonical 제외 전부 삭제.
 */

import { useMemo, useState } from 'react';
import { X, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { detectDuplicates, totalDuplicateCount, type DuplicateGroup } from '@/lib/projectDedupe';
import { toast } from '@/components/ui/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectDedupeModal({ isOpen, onClose }: Props) {
  const { projects, deleteProject } = useProjectStore();
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const groups = useMemo(() => detectDuplicates(projects), [projects]);
  const activeGroups = useMemo(
    () => groups.filter((g) => !excludedGroups.has(g.signature)),
    [groups, excludedGroups],
  );
  const totalToDelete = totalDuplicateCount(activeGroups);

  if (!isOpen) return null;

  const toggleGroup = (sig: string) => {
    setExcludedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(sig)) next.delete(sig);
      else next.add(sig);
      return next;
    });
  };

  const handleCleanup = async () => {
    if (totalToDelete === 0) return;
    setRunning(true);
    try {
      for (const g of activeGroups) {
        for (const dup of g.duplicates) {
          deleteProject(dup.id);
        }
      }
      // 즉시 저장해서 다음 로드 시 복구되지 않도록
      const { saveAllProjects } = await import('@/lib/storage');
      const latest = useProjectStore.getState().projects;
      await saveAllProjects(latest);
      toast.success(`${totalToDelete}개 프로젝트를 정리했습니다`);
      onClose();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                중복 프로젝트 정리
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" aria-label="닫기">
              <X size={16} />
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              중복으로 감지된 프로젝트가 없습니다.
            </p>
          ) : (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              이름 + 시트 구조가 동일한 프로젝트를 그룹화했습니다. 각 그룹에서{' '}
              <strong style={{ color: 'var(--text-primary)' }}>가장 최근 수정본 1개만 유지</strong>
              하고 나머지는 삭제됩니다.
            </p>
          )}
        </div>

        {/* 본문 — 그룹 리스트 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {groups.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 size={32} style={{ color: '#10b981' }} className="mx-auto mb-2" />
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>프로젝트가 모두 고유합니다</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>정리할 항목이 없습니다</p>
            </div>
          ) : (
            groups.map((g) => {
              const excluded = excludedGroups.has(g.signature);
              return (
                <div
                  key={g.signature}
                  className="rounded-lg border overflow-hidden transition-opacity"
                  style={{
                    borderColor: excluded ? 'var(--border-primary)' : 'var(--accent)',
                    background: excluded ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    opacity: excluded ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
                    <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                      {g.name}
                    </span>
                    <span
                      className="text-caption font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                    >
                      {g.projects.length}개
                    </span>
                    <label className="flex items-center gap-1 text-xs cursor-pointer select-none flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleGroup(g.signature)}
                        className="w-3 h-3"
                      />
                      정리
                    </label>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs p-1.5 rounded" style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--text-primary)' }}>
                      <CheckCircle2 size={11} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span className="flex-1 truncate">유지: <strong>{g.canonical.name}</strong></span>
                      <span className="font-mono text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(g.canonical.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {g.duplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className="flex items-center gap-2 text-xs p-1.5 rounded"
                        style={{
                          background: 'rgba(239,68,68,0.06)',
                          color: 'var(--text-secondary)',
                          textDecoration: excluded ? 'none' : 'line-through',
                        }}
                      >
                        <Trash2 size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <span className="flex-1 truncate">삭제: {dup.name}</span>
                        <span className="font-mono text-caption" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(dup.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 */}
        {groups.length > 0 && (
          <div className="px-5 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-primary)' }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {totalToDelete}개 프로젝트 삭제 예정
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-md hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleCleanup}
                disabled={totalToDelete === 0 || running}
                className="px-3 py-1.5 text-xs rounded-md font-semibold transition-opacity"
                style={{
                  background: totalToDelete === 0 ? 'var(--bg-tertiary)' : '#ef4444',
                  color: totalToDelete === 0 ? 'var(--text-tertiary)' : 'white',
                  opacity: running ? 0.6 : 1,
                }}
              >
                {running ? '정리 중...' : `${totalToDelete}개 정리`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
