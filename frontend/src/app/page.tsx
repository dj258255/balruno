'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectHistory, useTour, useYDocSync } from '@/hooks';
import { getTourByProjectId } from '@/data/tourSteps';
import {
  loadProjects,
  saveAllProjects,
  startAutoSave,
  stopAutoSave,
  startAutoBackup,
  stopAutoBackup,
} from '@/lib/storage';

// Layout components
import { Sidebar, SheetTabs } from '@/components/layout';

// Sheet components
import { SheetTable, StickerLayer } from '@/components/sheet';

// Track 4: 뷰 스위처 + 각 뷰 컴포넌트
import ViewSwitcher from '@/components/views/ViewSwitcher';
import FormView from '@/components/views/FormView';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import GalleryView from '@/components/views/GalleryView';
import GanttView from '@/components/views/GanttView';
import type { ViewType } from '@/types';

// Modal components - Dynamic imports for code splitting
import { useOnboardingStatus } from '@/components/modals';

const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false });
const SettingsModal = dynamic(() => import('@/components/modals/SettingsModal'), { ssr: false });
const ReferencesModal = dynamic(() => import('@/components/modals/ReferencesModal'), { ssr: false });
const OnboardingGuide = dynamic(() => import('@/components/modals/OnboardingGuide'), { ssr: false });
const ExportModal = dynamic(() => import('@/components/modals/ExportModal'), { ssr: false });
const ImportModal = dynamic(() => import('@/components/modals/ImportModal'), { ssr: false });

// Panel components - Dynamic imports for code splitting
const Calculator = dynamic(() => import('@/components/panels/Calculator'), { ssr: false });
const ComparisonChart = dynamic(() => import('@/components/panels/ComparisonChart'), { ssr: false });
const GrowthCurveChart = dynamic(() => import('@/components/panels/GrowthCurveChart'), { ssr: false });
const BalanceAnalysisPanel = dynamic(() => import('@/components/panels/BalanceAnalysisPanel'), { ssr: false });
const BalanceValidator = dynamic(() => import('@/components/panels/BalanceValidator'), { ssr: false });
const ImbalanceDetectorPanel = dynamic(() => import('@/components/panels/ImbalanceDetectorPanel'), { ssr: false });
const GoalSolverPanel = dynamic(() => import('@/components/panels/GoalSolverPanel'), { ssr: false });
const DifficultyCurve = dynamic(() => import('@/components/panels/DifficultyCurve'), { ssr: false });
const SimulationPanel = dynamic(() => import('@/components/panels/SimulationPanel'), { ssr: false });
const FormulaHelper = dynamic(() => import('@/components/panels/FormulaHelper'), { ssr: false });

// UI components
import { DraggablePanel } from '@/components/ui';

// Tour components
import { InteractiveTour } from '@/components/tour';

// Sub-components
import LoadingScreen from './components/LoadingScreen';
import WelcomeScreen from './components/WelcomeScreen';
import MobileHeader from './components/MobileHeader';
import MobileSidebar from './components/MobileSidebar';
import SheetHeader from './components/SheetHeader';
import BottomDock from '@/components/BottomDock';
import EmptySheetView from './components/EmptySheetView';
import DockedToolbox from '@/components/DockedToolbox';
import SidebarResizer from './components/SidebarResizer';

export default function Home() {
  const t = useTranslations();

  // Store
  const {
    projects,
    currentProjectId,
    currentSheetId,
    loadProjects: setProjects,
    setLastSaved,
    createSheet,
    addSticker,
    addColumn,
    addRow,
    updateCell,
    updateSheet,
  } = useProjectStore();

  // Track 0 Phase 2: Y.Doc ↔ Zustand 양방향 브릿지 (모든 편집이 Y.Doc 경유)
  useYDocSync();

  // Tour hook
  const { startTour } = useTour();

  // History — Y.UndoManager delegate
  const {
    handleUndo,
    handleRedo,
    handleHistoryJump,
    canUndo,
    canRedo,
    getHistory,
  } = useProjectHistory();

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Modal state
  const [showSettings, setShowSettings] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { showOnboarding, setShowOnboarding } = useOnboardingStatus();

  // Floating panel state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showPresetComparison, setShowPresetComparison] = useState(false);
  const [showImbalanceDetector, setShowImbalanceDetector] = useState(false);
  const [showGoalSolver, setShowGoalSolver] = useState(false);
  const [showBalanceAnalysis, setShowBalanceAnalysis] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showDpsVariance, setShowDpsVariance] = useState(false);
  const [showCurveFitting, setShowCurveFitting] = useState(false);

  // Bottom panel state
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const [showBalanceValidator, setShowBalanceValidator] = useState(false);
  const [showDifficultyCurve, setShowDifficultyCurve] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [showEntityDefinition, setShowEntityDefinition] = useState(false);

  // Refs
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // Derived state
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;
  const currentSheet = currentProject?.sheets.find((s) => s.id === currentSheetId) || null;
  const isModalOpen = showOnboarding || showReferences || showExportModal || showImportModal;

  // Track projects that have shown tour (using project creation time as marker)
  const shownToursRef = useRef<Set<string>>(new Set());

  // Initial data load — Y.Doc hydrate 는 useYDocSync 가 projects 변경에 반응해 자동 처리
  useEffect(() => {
    const init = async () => {
      try {
        const savedProjects = await loadProjects();
        if (savedProjects.length > 0) {
          setProjects(savedProjects);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [setProjects]);

  // Auto save setup
  useEffect(() => {
    if (!isLoading) {
      startAutoSave(
        () => useProjectStore.getState().projects,
        () => setLastSaved(Date.now()),
        30000
      );
      startAutoBackup(
        () => useProjectStore.getState().projects,
        () => console.log('Backup created'),
        300000
      );
      return () => {
        stopAutoSave();
        stopAutoBackup();
      };
    }
  }, [isLoading, setLastSaved]);

  // Save on project change
  useEffect(() => {
    if (!isLoading && projects.length > 0) {
      const timeout = setTimeout(() => {
        saveAllProjects(projects);
        setLastSaved(Date.now());
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [projects, isLoading, setLastSaved]);

  // Track 7: WelcomeScreen → ImportModal 열기 이벤트
  useEffect(() => {
    const handler = () => setShowImportModal(true);
    window.addEventListener('balruno:open-import-modal', handler);
    return () => window.removeEventListener('balruno:open-import-modal', handler);
  }, []);

  // Track 5: Cmd/Ctrl+K → Command Palette 토글
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // 인풋/텍스트에서 이미 포커스된 경우에도 팔레트 우선
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Track 5: CommandPalette → 각 도구 패널 열기 이벤트 라우팅
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ panel: string }>).detail;
      if (!detail?.panel) return;
      const panelSetters: Record<string, (v: boolean) => void> = {
        calculator: setShowCalculator,
        comparison: setShowComparison,
        chart: setShowChart,
        preset: setShowPresetComparison,
        imbalance: setShowImbalanceDetector,
        goal: setShowGoalSolver,
        balance: setShowBalanceAnalysis,
        economy: setShowEconomy,
        dpsVariance: setShowDpsVariance,
        curveFitting: setShowCurveFitting,
        formulaHelper: setShowFormulaHelper,
        balanceValidator: setShowBalanceValidator,
        difficultyCurve: setShowDifficultyCurve,
        simulation: setShowSimulation,
        entityDefinition: setShowEntityDefinition,
      };
      const setter = panelSetters[detail.panel];
      if (setter) {
        setter(true);
      }
    };
    window.addEventListener('balruno:open-panel', handler);
    return () => window.removeEventListener('balruno:open-panel', handler);
  }, []);

  // History panel outside click
  useEffect(() => {
    if (!showHistoryPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-history-panel]')) {
        setShowHistoryPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistoryPanel]);

  // Start tour for sample projects when first opened
  useEffect(() => {
    if (!currentProject || !currentSheet || isLoading) return;

    // Check if this project was just created (within last 2 seconds)
    const isNewProject = Date.now() - currentProject.createdAt < 2000;

    // Check if we haven't shown the tour for this project yet
    if (isNewProject && !shownToursRef.current.has(currentProject.id)) {
      // Try to find a tour for this project
      // Match by project name pattern to identify sample projects
      let sampleId: string | null = null;

      if (currentProject.name.includes('RPG') || currentProject.name.includes('캐릭터')) {
        sampleId = 'rpg-character';
      } else if (currentProject.name.includes('Weapon') || currentProject.name.includes('무기')) {
        sampleId = 'weapon-balance';
      } else if (currentProject.name.includes('EXP') || currentProject.name.includes('경험치')) {
        sampleId = 'exp-curve';
      } else if (currentProject.name.includes('Gacha') || currentProject.name.includes('가챠')) {
        sampleId = 'gacha-rates';
      }

      if (sampleId) {
        const tour = getTourByProjectId(sampleId);
        if (tour) {
          // Small delay to let the sheet render
          setTimeout(() => {
            startTour(tour);
            shownToursRef.current.add(currentProject.id);
          }, 500);
        }
      }
    }
  }, [currentProject, currentSheet, isLoading, startTour]);

  // Sidebar callbacks — 도킹 모드에서는 각 도구의 show state 토글만
  const sidebarCallbacks = {
    onShowHelp: () => setShowOnboarding(true),
    onShowReferences: () => setShowReferences(true),
    onShowSettings: () => setShowSettings(true),
    onShowExportModal: () => setShowExportModal(true),
    onShowImportModal: () => setShowImportModal(true),
    onShowCalculator: () => setShowCalculator(!showCalculator),
    onShowComparison: () => setShowComparison(!showComparison),
    onShowChart: () => setShowChart(!showChart),
    onShowPresetComparison: () => setShowPresetComparison(!showPresetComparison),
    onShowImbalanceDetector: () => setShowImbalanceDetector(!showImbalanceDetector),
    onShowGoalSolver: () => setShowGoalSolver(!showGoalSolver),
    onShowBalanceAnalysis: () => setShowBalanceAnalysis(!showBalanceAnalysis),
    onShowEconomy: () => setShowEconomy(!showEconomy),
    onShowDpsVariance: () => setShowDpsVariance(!showDpsVariance),
    onShowCurveFitting: () => setShowCurveFitting(!showCurveFitting),
    onToggleFormulaHelper: () => setShowFormulaHelper(!showFormulaHelper),
    onToggleBalanceValidator: () => setShowBalanceValidator(!showBalanceValidator),
    onToggleDifficultyCurve: () => setShowDifficultyCurve(!showDifficultyCurve),
    onToggleSimulation: () => setShowSimulation(!showSimulation),
    onToggleEntityDefinition: () => setShowEntityDefinition(!showEntityDefinition),
  };

  // Add memo handler
  const handleAddMemo = () => {
    if (currentProjectId && currentSheetId) {
      addSticker(currentProjectId, currentSheetId, {
        text: '',
        color: '#fef08a',
        x: 10 + Math.random() * 30,
        y: 10 + Math.random() * 30,
        width: 200,
        height: 120,
      });
    }
  };


  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="h-screen flex" style={{ background: 'var(--bg-secondary)' }}>
      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setShowMobileSidebar(true)} />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
        callbacks={{
          ...sidebarCallbacks,
          onShowChart: () => {
            setShowChart(true);
            setShowMobileSidebar(false);
          },
          onShowHelp: () => {
            setShowOnboarding(true);
            setShowMobileSidebar(false);
          },
          onShowCalculator: () => {
            setShowCalculator(true);
            setShowMobileSidebar(false);
          },
          onShowComparison: () => {
            setShowComparison(true);
            setShowMobileSidebar(false);
          },
          onShowReferences: () => {
            setShowReferences(true);
            setShowMobileSidebar(false);
          },
          onShowPresetComparison: () => {
            setShowPresetComparison(true);
            setShowMobileSidebar(false);
          },
          onShowImbalanceDetector: () => {
            setShowImbalanceDetector(true);
            setShowMobileSidebar(false);
          },
          onShowGoalSolver: () => {
            setShowGoalSolver(true);
            setShowMobileSidebar(false);
          },
          onShowBalanceAnalysis: () => {
            setShowBalanceAnalysis(true);
            setShowMobileSidebar(false);
          },
          onShowEconomy: () => {
            setShowEconomy(true);
            setShowMobileSidebar(false);
          },
          onShowDpsVariance: () => {
            setShowDpsVariance(true);
            setShowMobileSidebar(false);
          },
          onShowCurveFitting: () => {
            setShowCurveFitting(true);
            setShowMobileSidebar(false);
          },
          onShowSettings: () => {
            setShowSettings(true);
            setShowMobileSidebar(false);
          },
          onShowExportModal: () => {
            setShowExportModal(true);
            setShowMobileSidebar(false);
          },
          onShowImportModal: () => {
            setShowImportModal(true);
            setShowMobileSidebar(false);
          },
          onToggleFormulaHelper: () => {
            setShowFormulaHelper(true);
            setShowMobileSidebar(false);
          },
          onToggleBalanceValidator: () => {
            setShowBalanceValidator(true);
            setShowMobileSidebar(false);
          },
          onToggleDifficultyCurve: () => {
            setShowDifficultyCurve(true);
            setShowMobileSidebar(false);
          },
          onToggleSimulation: () => {
            setShowSimulation(true);
            setShowMobileSidebar(false);
          },
          onToggleEntityDefinition: () => {
            setShowEntityDefinition(true);
            setShowMobileSidebar(false);
          },
        }}
        activeTools={{
          calculator: showCalculator,
          comparison: showComparison,
          chart: showChart,
          presetComparison: showPresetComparison,
          imbalanceDetector: showImbalanceDetector,
          goalSolver: showGoalSolver,
          balanceAnalysis: showBalanceAnalysis,
          economy: showEconomy,
          dpsVariance: showDpsVariance,
          curveFitting: showCurveFitting,
          formulaHelper: showFormulaHelper,
          balanceValidator: showBalanceValidator,
          difficultyCurve: showDifficultyCurve,
          simulation: showSimulation,
          entityDefinition: showEntityDefinition,
        }}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          {...sidebarCallbacks}
          activeTools={{
            calculator: showCalculator,
            comparison: showComparison,
            chart: showChart,
            presetComparison: showPresetComparison,
            imbalanceDetector: showImbalanceDetector,
            goalSolver: showGoalSolver,
            balanceAnalysis: showBalanceAnalysis,
            economy: showEconomy,
            dpsVariance: showDpsVariance,
            curveFitting: showCurveFitting,
            formulaHelper: showFormulaHelper,
            balanceValidator: showBalanceValidator,
            difficultyCurve: showDifficultyCurve,
            simulation: showSimulation,
            entityDefinition: showEntityDefinition,
          }}
        />
      </div>

      {/* Sidebar Resizer */}
      <SidebarResizer />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {currentProject ? (
          <>
            <SheetTabs project={currentProject} />

            <div className="flex-1 flex overflow-hidden">
              {currentSheet ? (
                <div
                  ref={sheetContainerRef}
                  className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 pb-0 min-h-0 overflow-hidden relative"
                >
                  <StickerLayer containerRef={sheetContainerRef} />

                  <SheetHeader
                    sheet={currentSheet}
                  />

                  {/* Track 4: 뷰 스위처 */}
                  <ViewSwitcher
                    activeView={currentSheet.activeView ?? 'grid'}
                    onChange={(view) =>
                      updateSheet(currentProject.id, currentSheet.id, { activeView: view })
                    }
                  />

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {(() => {
                      const view: ViewType = currentSheet.activeView ?? 'grid';
                      switch (view) {
                        case 'grid':
                          return <SheetTable projectId={currentProject.id} sheet={currentSheet} onAddMemo={handleAddMemo} />;
                        case 'form':
                          return <FormView projectId={currentProject.id} sheet={currentSheet} />;
                        case 'kanban':
                          return <KanbanView projectId={currentProject.id} sheet={currentSheet} />;
                        case 'calendar':
                          return <CalendarView projectId={currentProject.id} sheet={currentSheet} />;
                        case 'gallery':
                          return <GalleryView projectId={currentProject.id} sheet={currentSheet} />;
                        case 'gantt':
                          return <GanttView projectId={currentProject.id} sheet={currentSheet} />;
                      }
                    })()}
                  </div>
                </div>
              ) : (
                <EmptySheetView onCreateSheet={() => createSheet(currentProject.id, t('sheet.newSheet'))} />
              )}
            </div>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>

      {/* Modals */}
      {showOnboarding && <OnboardingGuide onClose={() => setShowOnboarding(false)} />}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      {showReferences && <ReferencesModal onClose={() => setShowReferences(false)} />}
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}

      {/* Track 6: Docked Toolbox — 우측 사이드 도킹 영역 (플로팅 ToolPanels 대체) */}
      <DockedToolbox
        panels={{
          calculator: { show: showCalculator, setShow: setShowCalculator },
          comparison: { show: showComparison, setShow: setShowComparison },
          chart: { show: showChart, setShow: setShowChart },
          preset: { show: showPresetComparison, setShow: setShowPresetComparison },
          imbalance: { show: showImbalanceDetector, setShow: setShowImbalanceDetector },
          goal: { show: showGoalSolver, setShow: setShowGoalSolver },
          balance: { show: showBalanceAnalysis, setShow: setShowBalanceAnalysis },
          economy: { show: showEconomy, setShow: setShowEconomy },
          dpsVariance: { show: showDpsVariance, setShow: setShowDpsVariance },
          curveFitting: { show: showCurveFitting, setShow: setShowCurveFitting },
          formulaHelper: { show: showFormulaHelper, setShow: setShowFormulaHelper },
          balanceValidator: { show: showBalanceValidator, setShow: setShowBalanceValidator },
          difficultyCurve: { show: showDifficultyCurve, setShow: setShowDifficultyCurve },
          simulation: { show: showSimulation, setShow: setShowSimulation },
          entityDefinition: { show: showEntityDefinition, setShow: setShowEntityDefinition },
        }}
      />

      {/* Track 6 후속: 9 그룹 하단 독바 (진입점 통일) */}
      <BottomDock
        panels={{
          calculator: { show: showCalculator, setShow: setShowCalculator },
          comparison: { show: showComparison, setShow: setShowComparison },
          chart: { show: showChart, setShow: setShowChart },
          preset: { show: showPresetComparison, setShow: setShowPresetComparison },
          imbalance: { show: showImbalanceDetector, setShow: setShowImbalanceDetector },
          goal: { show: showGoalSolver, setShow: setShowGoalSolver },
          balance: { show: showBalanceAnalysis, setShow: setShowBalanceAnalysis },
          economy: { show: showEconomy, setShow: setShowEconomy },
          dpsVariance: { show: showDpsVariance, setShow: setShowDpsVariance },
          curveFitting: { show: showCurveFitting, setShow: setShowCurveFitting },
          formulaHelper: { show: showFormulaHelper, setShow: setShowFormulaHelper },
          balanceValidator: { show: showBalanceValidator, setShow: setShowBalanceValidator },
          difficultyCurve: { show: showDifficultyCurve, setShow: setShowDifficultyCurve },
          simulation: { show: showSimulation, setShow: setShowSimulation },
          entityDefinition: { show: showEntityDefinition, setShow: setShowEntityDefinition },
        }}
        isModalOpen={isModalOpen}
      />

      {/* Track 5: Command Palette (⌘K) */}
      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Interactive Tour */}
      <InteractiveTour tableContainerRef={sheetContainerRef} />
    </main>
  );
}
