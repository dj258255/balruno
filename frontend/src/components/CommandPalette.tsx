'use client';

/**
 * ⌘K Command Palette — cmdk 라이브러리 기반 전역 명령 팔레트.
 *
 * 그룹:
 *  - Recent: 최근 접근 시트 (localStorage `balruno:recent-sheets`)
 *  - Navigate: 전체 프로젝트/시트
 *  - Create: 새 프로젝트/시트/AI 시작
 *  - Views: 뷰 전환 (Grid/Kanban/Calendar/Gallery/Gantt/Form)
 *  - Tools: 패널 열기 (balruno:open-panel-* 이벤트)
 *  - Functions: 수식 함수 검색 → Formula Helper 연동
 *  - Settings: 테마 / 중복 정리 / 단축키 도움말
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
  Clock,
  Wand2,
  Grid3x3,
  Kanban,
  Calendar,
  Image,
  GanttChart,
  ClipboardList,
  Download,
  Upload,
  Keyboard,
  Trash2,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useTheme } from '@/contexts/ThemeContext';
import { availableFunctions } from '@/lib/formulaEngine';
import { loadRecent, type RecentEntry } from '@/lib/recentSheets';

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

/** 키보드 힌트 표시. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="text-caption px-1.5 py-0.5 rounded ml-auto shrink-0"
      style={{
        background: 'var(--bg-tertiary)',
        color: 'var(--text-tertiary)',
        border: '1px solid var(--border-primary)',
        fontFamily: 'var(--font-mono, ui-monospace)',
      }}
    >
      {children}
    </kbd>
  );
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
  const currentSheetId = useProjectStore((s) => s.currentSheetId);

  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch('');
    } else {
      setRecent(loadRecent());
    }
  }, [open]);

  // 모든 시트 flatten (프로젝트당 시트들). tags 까지 검색 value 에 포함.
  const allSheets = useMemo(() => {
    return projects.flatMap((p) =>
      p.sheets.map((s) => ({
        projectId: p.id,
        projectName: p.name,
        sheetId: s.id,
        sheetName: s.name,
        tags: s.tags ?? [],
      }))
    );
  }, [projects]);

  const sheetLookup = useMemo(() => {
    const map = new Map<string, { projectId: string; projectName: string; sheetName: string }>();
    allSheets.forEach((s) => {
      map.set(s.sheetId, { projectId: s.projectId, projectName: s.projectName, sheetName: s.sheetName });
    });
    return map;
  }, [allSheets]);

  const recentItems = useMemo(() => {
    return recent
      .map((e) => ({ ...e, meta: sheetLookup.get(e.sheetId) }))
      .filter((e): e is RecentEntry & { meta: NonNullable<ReturnType<typeof sheetLookup.get>> } => Boolean(e.meta))
      .filter((e) => e.sheetId !== currentSheetId);
  }, [recent, sheetLookup, currentSheetId]);

  const emitOpenPanel = (panel: string) => {
    window.dispatchEvent(new CustomEvent('balruno:open-panel', { detail: { panel } }));
  };

  const emitSetView = (view: string) => {
    window.dispatchEvent(new CustomEvent('balruno:set-view', { detail: { view } }));
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
            <Kbd>ESC</Kbd>
          </div>

          <Command.List className="max-h-[55vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('commandPalette.noResults')}
            </Command.Empty>

            {/* Recent */}
            {recentItems.length > 0 && !search && (
              <Command.Group heading={t('commandPalette.recent')}>
                {recentItems.map((item) => (
                  <Command.Item
                    key={`recent-${item.sheetId}`}
                    value={`recent ${item.meta.sheetName} ${item.meta.projectName}`}
                    onSelect={() =>
                      runAction(() => {
                        setCurrentProject(item.projectId);
                        setCurrentSheet(item.sheetId);
                      })
                    }
                    className="cmdk-item"
                  >
                    <Clock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.meta.sheetName}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {item.meta.projectName}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigate — 모든 시트. tags 도 검색 value 에 포함되어 #tag:wip 같은 query 로 매칭 */}
            {allSheets.length > 0 && (
              <Command.Group heading={t('commandPalette.navigate')}>
                {allSheets.map((item) => {
                  // cmdk fuzzy matching 용 value: 프로젝트/시트/tags 한 줄에 합쳐 hash prefix 도 포함
                  const tagSearchTokens = item.tags.flatMap((tg) => [tg, `#${tg}`]).join(' ');
                  return (
                    <Command.Item
                      key={`sheet-${item.sheetId}`}
                      value={`${item.projectName} ${item.sheetName} ${tagSearchTokens}`}
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
                        {item.tags.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            {item.tags.slice(0, 3).map((tg) => (
                              <span
                                key={tg}
                                className="text-[10px] px-1 rounded"
                                style={{
                                  background: 'var(--bg-tertiary)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-secondary)',
                                }}
                              >
                                {tg}
                              </span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                +{item.tags.length - 3}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Create */}
            <Command.Group heading={t('commandPalette.create')}>
              <Command.Item
                value="new project create"
                onSelect={() => runAction(() => createProject(t('sidebar.newProject')))}
                className="cmdk-item"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.newProject')}
                </span>
                <Kbd>⌘⇧N</Kbd>
              </Command.Item>
              {currentProjectId && (
                <Command.Item
                  value="new sheet create"
                  onSelect={() => runAction(() => createSheet(currentProjectId, t('sheet.newSheet')))}
                  className="cmdk-item"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {t('commandPalette.newSheet')}
                  </span>
                  <Kbd>⌘N</Kbd>
                </Command.Item>
              )}
              <Command.Item
                value="ai setup start new project wizard"
                onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-ai-setup')))}
                className="cmdk-item"
              >
                <Wand2 className="w-4 h-4" style={{ color: 'var(--primary-purple)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.aiStart')}
                </span>
              </Command.Item>
              <Command.Item
                value={t('commandPalette.searchValueGallery')}
                onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-gallery')))}
                className="cmdk-item"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.galleryTemplate')}
                </span>
              </Command.Item>
              <Command.Item
                value="import excel csv data"
                onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-import-modal')))}
                className="cmdk-item"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.csvImport')}
                </span>
              </Command.Item>
              <Command.Item
                value="export data json csv engine"
                onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-export-modal')))}
                className="cmdk-item"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.exportJson')}
                </span>
              </Command.Item>
              {currentProjectId && (
                <Command.Item
                  value="share collaborate"
                  onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-share')))}
                  className="cmdk-item"
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {t('commandPalette.shareCollab')}
                  </span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Views */}
            {currentSheetId && (
              <Command.Group heading={t('commandPalette.viewSwitch')}>
                <Command.Item value="view grid sheet table" onSelect={() => runAction(() => emitSetView('grid'))} className="cmdk-item">
                  <Grid3x3 className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Grid</span>
                  <Kbd>G</Kbd>
                </Command.Item>
                <Command.Item value="view kanban board" onSelect={() => runAction(() => emitSetView('kanban'))} className="cmdk-item">
                  <Kanban className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Kanban</span>
                  <Kbd>K</Kbd>
                </Command.Item>
                <Command.Item value="view calendar date" onSelect={() => runAction(() => emitSetView('calendar'))} className="cmdk-item">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Calendar</span>
                  <Kbd>C</Kbd>
                </Command.Item>
                <Command.Item value="view gallery cards" onSelect={() => runAction(() => emitSetView('gallery'))} className="cmdk-item">
                  <Image className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Gallery</span>
                  <Kbd>Y</Kbd>
                </Command.Item>
                <Command.Item value="view gantt timeline" onSelect={() => runAction(() => emitSetView('gantt'))} className="cmdk-item">
                  <GanttChart className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Gantt</span>
                  <Kbd>T</Kbd>
                </Command.Item>
                <Command.Item value="view form survey" onSelect={() => runAction(() => emitSetView('form'))} className="cmdk-item">
                  <ClipboardList className="w-4 h-4" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Form</span>
                  <Kbd>F</Kbd>
                </Command.Item>
              </Command.Group>
            )}

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
              <Command.Item value="imbalance detector outlier" onSelect={() => runAction(() => emitOpenPanel('imbalance'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.imbalanceDetector')}</span>
              </Command.Item>
              <Command.Item value="formula helper functions" onSelect={() => runAction(() => emitOpenPanel('formulaHelper'))} className="cmdk-item">
                <FunctionSquare className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.formulaHelper')}</span>
                <Kbd>⌘⇧F</Kbd>
              </Command.Item>
              <Command.Item value="preset template library" onSelect={() => runAction(() => emitOpenPanel('preset'))} className="cmdk-item">
                <CalcIcon className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('sidebar.presetComparison')}</span>
              </Command.Item>
              <Command.Item value="entity definition level table" onSelect={() => runAction(() => emitOpenPanel('entityDefinition'))} className="cmdk-item">
                <Users className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('bottomTabs.entityDefinition')}</span>
              </Command.Item>
              <Command.Item value="difficulty curve stage wall milestone" onSelect={() => runAction(() => emitOpenPanel('difficultyCurve'))} className="cmdk-item">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('bottomTabs.difficultyCurve')}</span>
              </Command.Item>
              <Command.Item value="auto balancer ai optimize" onSelect={() => runAction(() => emitOpenPanel('autoBalancer'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--primary-purple)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>AI Auto-Balancer</span>
              </Command.Item>
              <Command.Item value="loot gacha simulator monte carlo" onSelect={() => runAction(() => emitOpenPanel('lootSimulator'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Loot / Gacha Simulator</span>
              </Command.Item>
              <Command.Item value="power curve compare overlay" onSelect={() => runAction(() => emitOpenPanel('powerCurveCompare'))} className="cmdk-item">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Power Curve Compare</span>
              </Command.Item>
              <Command.Item value="comments mentions thread team" onSelect={() => runAction(() => emitOpenPanel('comments'))} className="cmdk-item">
                <Users className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('commandPalette.commentsMentions')}</span>
              </Command.Item>
              <Command.Item value="interface designer dashboard widgets" onSelect={() => runAction(() => emitOpenPanel('interfaceDesigner'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Interface Designer</span>
              </Command.Item>
              <Command.Item value="automations workflow trigger" onSelect={() => runAction(() => emitOpenPanel('automations'))} className="cmdk-item">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Automations</span>
              </Command.Item>
            </Command.Group>

            {/* Functions — 수식 */}
            <Command.Group heading={t('commandPalette.functions')}>
              {(availableFunctions as FunctionEntry[]).slice(0, 80).map((fn) => (
                <Command.Item
                  key={`fn-${fn.name}`}
                  value={`${fn.name} ${fn.description ?? ''} ${fn.syntax ?? ''} ${fn.category ?? ''}`}
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
                  {fn.category && (
                    <span
                      className="text-caption px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {fn.category}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Settings */}
            <Command.Group heading={t('commandPalette.settings')}>
              <Command.Item
                value="toggle theme dark light mode"
                onSelect={() => runAction(toggleTheme)}
                className="cmdk-item"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.toggleTheme')}
                </span>
                <Kbd>⌘⇧L</Kbd>
              </Command.Item>
              <Command.Item
                value="keyboard shortcuts help"
                onSelect={() => runAction(() => window.dispatchEvent(new Event('balruno:open-shortcuts')))}
                className="cmdk-item"
              >
                <Keyboard className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.keyboardShortcuts')}
                </span>
                <Kbd>?</Kbd>
              </Command.Item>
              <Command.Item
                value={t('commandPalette.searchValueDedupe')}
                onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('balruno:open-dedupe')))}
                className="cmdk-item"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('commandPalette.dedupeProjects')}
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
