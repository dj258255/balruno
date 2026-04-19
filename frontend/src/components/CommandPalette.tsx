'use client';

/**
 * Track 5 — ⌘K Command Palette.
 *
 * 전역 단축키 (Cmd/Ctrl+K) 로 호출. cmdk 라이브러리의 fuzzy 매칭 + 키보드 네비 활용.
 *
 * 카테고리:
 *  - Navigate: 프로젝트 / 시트 빠른 전환
 *  - Create: 새 프로젝트 / 새 시트
 *  - Functions: 수식 함수 검색 (availableFunctions 리스트)
 *  - Tools: 도구 패널 열기 (balruno:open-panel-* 이벤트)
 *  - Settings: 테마 전환 / 언어 전환
 */

import { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useTranslations } from 'next-intl';
import {
  Search,
  FileText,
  FolderPlus,
  Plus,
  Calculator as CalcIcon,
  BarChart3,
  Sparkles,
  Moon,
  Sun,
  FunctionSquare,
  Users,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useTheme } from '@/contexts/ThemeContext';
import { availableFunctions } from '@/lib/formulaEngine';

type FunctionEntry = {
  name: string;
  description?: string;
  syntax?: string;
  example?: string;
  category?: string;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const t = useTranslations();
  const { theme, toggleTheme } = useTheme();
  const projects = useProjectStore((s) => s.projects);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const createProject = useProjectStore((s) => s.createProject);
  const createSheet = useProjectStore((s) => s.createSheet);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const [search, setSearch] = useState('');

  // Cmd/Ctrl+K 전역 리스너는 부모에서 open 토글. 이 컴포넌트는 닫히면 search 리셋.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // 모든 시트 flatten (프로젝트당 시트들)
  const allSheets = useMemo(() => {
    return projects.flatMap((p) =>
      p.sheets.map((s) => ({
        projectId: p.id,
        projectName: p.name,
        sheetId: s.id,
        sheetName: s.name,
      }))
    );
  }, [projects]);

  const emitOpenPanel = (panel: string) => {
    window.dispatchEvent(new CustomEvent('balruno:open-panel', { detail: { panel } }));
  };

  const runAction = (fn: () => void) => {
    fn();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label={t('commandPalette.title')} className="flex flex-col">
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t('commandPalette.searchPlaceholder')}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
              autoFocus
            />
            <kbd
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('commandPalette.noResults')}
            </Command.Empty>

            {/* Navigate */}
            {allSheets.length > 0 && (
              <Command.Group heading={t('commandPalette.navigate')} className="cmdk-group">
                {allSheets.map((item) => (
                  <Command.Item
                    key={`sheet-${item.sheetId}`}
                    value={`${item.projectName} ${item.sheetName}`}
                    onSelect={() =>
                      runAction(() => {
                        setCurrentProject(item.projectId);
                        setCurrentSheet(item.sheetId);
                      })
                    }
                    className="cmdk-item"
                  >
                    <FileText className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {item.sheetName}
                      </span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {item.projectName}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Create */}
            <Command.Group heading={t('commandPalette.create')}>
              <Command.Item
                value="new project"
                onSelect={() =>
                  runAction(() => {
                    createProject(t('sidebar.newProject'));
                  })
                }
                className="cmdk-item"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.newProject')}
                </span>
              </Command.Item>
              {currentProjectId && (
                <Command.Item
                  value="new sheet"
                  onSelect={() =>
                    runAction(() => {
                      createSheet(currentProjectId, t('sheet.newSheet'));
                    })
                  }
                  className="cmdk-item"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {t('commandPalette.newSheet')}
                  </span>
                </Command.Item>
              )}
              {currentProjectId && (
                <Command.Item
                  value="share collaborate"
                  onSelect={() =>
                    runAction(() => {
                      window.dispatchEvent(new Event('balruno:open-share'));
                    })
                  }
                  className="cmdk-item"
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    프로젝트 공유 / 협업
                  </span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Tools */}
            <Command.Group heading={t('commandPalette.tools')}>
              <Command.Item value="calculator" onSelect={() => runAction(() => emitOpenPanel('calculator'))} className="cmdk-item">
                <CalcIcon className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.calculator')}</span>
              </Command.Item>
              <Command.Item value="comparison chart" onSelect={() => runAction(() => emitOpenPanel('comparison'))} className="cmdk-item">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.comparison')}</span>
              </Command.Item>
              <Command.Item value="growth curve chart" onSelect={() => runAction(() => emitOpenPanel('chart'))} className="cmdk-item">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.chart')}</span>
              </Command.Item>
              <Command.Item value="imbalance detector" onSelect={() => runAction(() => emitOpenPanel('imbalance'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.imbalanceDetector')}</span>
              </Command.Item>
              <Command.Item value="formula helper" onSelect={() => runAction(() => emitOpenPanel('formulaHelper'))} className="cmdk-item">
                <FunctionSquare className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.formulaHelper')}</span>
              </Command.Item>
            </Command.Group>

            {/* Functions (수식) */}
            <Command.Group heading={t('commandPalette.functions')}>
              {(availableFunctions as FunctionEntry[]).slice(0, 50).map((fn) => (
                <Command.Item
                  key={`fn-${fn.name}`}
                  value={`${fn.name} ${fn.description ?? ''} ${fn.syntax ?? ''}`}
                  onSelect={() =>
                    runAction(() => {
                      emitOpenPanel('formulaHelper');
                      window.dispatchEvent(
                        new CustomEvent('balruno:select-formula', { detail: { name: fn.name } })
                      );
                    })
                  }
                  className="cmdk-item"
                >
                  <FunctionSquare className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                      {fn.name}
                    </span>
                    {fn.description && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {fn.description}
                      </span>
                    )}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Settings */}
            <Command.Group heading={t('commandPalette.settings')}>
              <Command.Item
                value="toggle theme dark light"
                onSelect={() => runAction(toggleTheme)}
                className="cmdk-item"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.toggleTheme')}
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>

      <style jsx>{`
        :global(.cmdk-item) {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          user-select: none;
        }
        :global(.cmdk-item[data-selected='true']) {
          background: var(--bg-hover);
        }
        :global([cmdk-group-heading]) {
          padding: 0.5rem 0.75rem 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
