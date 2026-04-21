/**
 * NewProjectForm - 새 프로젝트 생성 폼 컴포넌트
 */

'use client';

import { FolderPlus, Check, X, LayoutTemplate } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface NewProjectFormProps {
  showNewProject: boolean;
  setShowNewProject: (show: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  onCreateProject: () => void;
}

export function NewProjectForm({
  showNewProject,
  setShowNewProject,
  newProjectName,
  setNewProjectName,
  onCreateProject,
}: NewProjectFormProps) {
  const t = useTranslations();

  if (!showNewProject) {
    return (
      <div className="p-3 border-b space-y-1.5" style={{ borderColor: 'var(--border-primary)' }}>
        <button
          onClick={() => setShowNewProject(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'white'
          }}
        >
          <FolderPlus className="w-4 h-4" />
          {t('sidebar.newProject')}
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event('balruno:open-gallery'))}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
          title="템플릿으로 빠르게 시작"
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          템플릿 갤러리
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreateProject();
            if (e.key === 'Escape') {
              setShowNewProject(false);
              setNewProjectName('');
            }
          }}
          placeholder={t('project.projectName')}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg"
          autoFocus
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onCreateProject}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: 'var(--accent)',
              color: 'white'
            }}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowNewProject(false);
              setNewProjectName('');
            }}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
