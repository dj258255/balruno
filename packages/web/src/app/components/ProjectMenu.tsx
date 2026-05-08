/**
 * 프로젝트 레벨 액션 드롭다운 — SheetTabs 바 우측에 배치.
 *
 * 항목:
 *  - 복제
 *  - 내보내기 ▸ (전체 / 엑셀 / 게임 엔진 SDK)
 *  - 가져오기
 *  - 삭제 (confirm 2-step)
 *
 * Sidebar Footer 의 Export/Import 버튼을 대체.
 */

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Copy, Download, Upload, Trash2, HelpCircle, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';

interface ProjectMenuProps {
  onShowExport: () => void;
  onShowImport: () => void;
  onShowHelp?: () => void;
  onShowReferences?: () => void;
}

export default function ProjectMenu({ onShowExport, onShowImport, onShowHelp, onShowReferences }: ProjectMenuProps) {
  const t = useTranslations('project');
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { projects, currentProjectId, duplicateProject, deleteProject } = useProjectStore();
  const currentProject = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!currentProject) return null;

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  const handleDuplicate = run(() => {
    duplicateProject(currentProject.id);
    toast.success(t('duplicated'));
  });

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteProject(currentProject.id);
    toast.info(t('deleted'));
    setOpen(false);
    setConfirmDelete(false);
  };

  const Item = ({
    icon: Icon, label, onClick, danger,
  }: {
    icon: typeof Copy;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors"
      style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
    >
      <Icon size={12} className="flex-shrink-0" />
      <span className="flex-1">{label}</span>
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
        aria-label={t('menuLabel')}
        title={t('menuLabel')}
      >
        <MoreHorizontal size={16} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg shadow-xl border py-1 overflow-hidden"
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          role="menu"
        >
          <div className="px-2.5 py-1.5 text-overline truncate" style={{ color: 'var(--text-tertiary)' }}>
            {currentProject.name}
          </div>
          <div className="h-px mx-1 my-1" style={{ background: 'var(--border-primary)' }} />

          <Item icon={Copy} label={t('duplicate')} onClick={handleDuplicate} />
          <Item icon={Download} label={t('exportLabel')} onClick={run(onShowExport)} />
          <Item icon={Upload} label={t('importLabel')} onClick={run(onShowImport)} />

          {(onShowHelp || onShowReferences) && (
            <div className="h-px mx-1 my-1" style={{ background: 'var(--border-primary)' }} />
          )}
          {onShowHelp && (
            <Item icon={HelpCircle} label={t('helpGuide')} onClick={run(onShowHelp)} />
          )}
          {onShowReferences && (
            <Item icon={BookOpen} label={t('references')} onClick={run(onShowReferences)} />
          )}

          <div className="h-px mx-1 my-1" style={{ background: 'var(--border-primary)' }} />

          <Item
            icon={Trash2}
            label={confirmDelete ? t('deleteConfirmAgain') : t('delete')}
            onClick={handleDelete}
            danger
          />
        </div>
      )}
    </div>
  );
}
