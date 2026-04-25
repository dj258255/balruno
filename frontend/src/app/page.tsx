'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectHistory, useTour, useYDocSync } from '@/hooks';
import { usePanelStates } from '@/hooks/usePanelStates';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useGlobalEvents } from '@/hooks/useGlobalEvents';
import { useGlobalKeybinds } from '@/hooks/useGlobalKeybinds';
import { useAutomationObserver } from '@/hooks/useAutomationObserver';
import { getTourByProjectId } from '@/data/tourSteps';
import { loadProjects } from '@/lib/storage';
import { recordRecentSheet } from '@/lib/recentSheets';
import { initErrorReporting } from '@/lib/errorReporting';
import { useTheme } from '@/contexts/ThemeContext';

// Layout components
import { Sidebar, SheetTabs } from '@/components/layout';

// Sheet components
import { SheetTable, StickerLayer } from '@/components/sheet';
import { PmBadgeStrip } from '@/components/sheet/PmBadgeStrip';

// TrackPresence
import PresenceIndicator from '@/components/PresenceIndicator';

// 뷰 스위처 + 각 뷰 컴포넌트
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
const AISetupModal = dynamic(() => import('@/components/modals/AISetupModal'), { ssr: false });
const ShareModal = dynamic(() => import('@/components/modals/ShareModal'), { ssr: false });
const KeyboardShortcuts = dynamic(() => import('@/components/modals/KeyboardShortcuts'), { ssr: false });
const ToastContainer = dynamic(() => import('@/components/ui/Toast'), { ssr: false });
const ProjectDedupeModal = dynamic(() => import('@/components/modals/ProjectDedupeModal'), { ssr: false });
const ProjectGalleryModal = dynamic(() => import('@/components/modals/ProjectGalleryModal'), { ssr: false });
const SettingsModal = dynamic(() => import('@/components/modals/SettingsModal'), { ssr: false });
const ReferencesModal = dynamic(() => import('@/components/modals/ReferencesModal'), { ssr: false });
const OnboardingGuide = dynamic(() => import('@/components/modals/OnboardingGuide'), { ssr: false });
const PersonaModal = dynamic(() => import('@/components/modals/PersonaModal'), { ssr: false });
const ProductIntroModal = dynamic(() => import('@/components/modals/ProductIntroModal'), { ssr: false });
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
// HomeScreen / DocView / AICopilotPanel 은 대형 의존성 (recharts, Tiptap, AI SDK)
// 을 끌고 오므로 dynamic — 필요 시에만 번들 로드. 초기 진입 체감 속도 대폭 개선.
const HomeScreen = dynamic(() => import('@/components/home/HomeScreen'), {
  ssr: false,
  loading: () => <div className="flex-1" />,
});
const DocView = dynamic(() => import('@/components/docs/DocView'), {
  ssr: false,
  loading: () => <div className="flex-1" />,
});
const AICopilotPanel = dynamic(() => import('@/components/ai/AICopilotPanel'), { ssr: false });
import MobileHeader from './components/MobileHeader';
import MobileNotice from './components/MobileNotice';
import MobileSidebar from './components/MobileSidebar';
import SheetHeader from './components/SheetHeader';
import BottomDock from '@/components/BottomDock';
import { GlobalRecordDetail } from '@/components/panels/GlobalRecordDetail';
import InboxPanel from '@/components/panels/InboxPanel';
import ProjectMenu from './components/ProjectMenu';
import DockedToolbox from '@/components/DockedToolbox';
import SidebarResizer from './components/SidebarResizer';

export default function Home() {
  const t = useTranslations();

  // Store
  const {
    projects,
    currentProjectId,
    currentSheetId,
    currentDocId,
    setCurrentDoc,
    loadProjects: setProjects,
    setLastSaved,
    createProject,
    createSheet,
    addSticker,
    addColumn,
    addRow,
    updateCell,
    updateSheet,
  } = useProjectStore();

  const { toggleTheme } = useTheme();

  // TrackPhase 2: Y.Doc ↔ Zustand 양방향 브릿지 (모든 편집이 Y.Doc 경유)
  useYDocSync();

  // (useAutomationObserver 는 아래 currentProjectId 바인딩 이후 호출)

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
  const [showAISetup, setShowAISetup] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showDedupeModal, setShowDedupeModal] = useState(false);

  // Modal state
  const [showSettings, setShowSettings] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { showOnboarding, setShowOnboarding } = useOnboardingStatus();

  // ProductIntro 최초 자동 노출 — persona 선택 끝났고 아직 intro 본 적 없을 때.
  // starter seed 사용자에겐 모달 자동 표시 skip (튜토리얼 시트 + Welcome doc 이 그 역할 대신).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('balruno:starter-seeded') === '1') return;
    const personaRaw = window.localStorage.getItem('balruno:persona');
    const hasPersona = (() => {
      try { return personaRaw ? JSON.parse(personaRaw).state?.hasChosen === true : false; } catch { return false; }
    })();
    if (!hasPersona) return;

    const introRaw = window.localStorage.getItem('balruno:product-intro');
    const hasSeen = (() => {
      try { return introRaw ? JSON.parse(introRaw).state?.seenAt != null : false; } catch { return false; }
    })();
    if (hasSeen) return;

    // 1 초 딜레이 후 — 다른 모달 (persona) 닫힘 보장
    const timer = setTimeout(() => {
      import('@/stores/productIntroStore').then(({ useProductIntro }) => {
        useProductIntro.getState().openIntro();
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // 21개 툴 패널 상태 — 단일 hook 으로 통합 (page.tsx 분해)
  const { panels: toolPanels } = usePanelStates();

  // 활성 자동화의 cell-changed / row-added trigger 자동 발동
  useAutomationObserver(currentProjectId);


  // 중복 프로젝트 자동 감지 — 세션당 1회, 초기 로드 후
  useEffect(() => {
    if (isLoading || projects.length < 2) return;
    const dismissed = typeof window !== 'undefined'
      ? sessionStorage.getItem('balruno:dedupe-dismissed') === '1'
      : true;
    if (dismissed) return;

    // 동적 import (초기 번들 가볍게)
    import('@/lib/projectDedupe').then(({ detectDuplicates, totalDuplicateCount }) => {
      const groups = detectDuplicates(projects);
      const count = totalDuplicateCount(groups);
      if (count > 0) {
        import('@/components/ui/Toast').then(({ toast }) => {
          // 토스트는 클릭 액션이 없으므로 warning 으로 알림 + 사용자가 명령 팔레트 / 이벤트로 열기
          toast.warning(`중복 프로젝트 ${count}개 감지됨. ⌘K 에서 "중복 정리" 검색`, 8000);
        });
        sessionStorage.setItem('balruno:dedupe-dismissed', '1');
      }
    });
  }, [isLoading, projects]);

  // 중복 정리 모달 이벤트 (CommandPalette / Sidebar 에서 발행)
  useEffect(() => {
    const handler = () => setShowDedupeModal(true);
    window.addEventListener('balruno:open-dedupe', handler);
    return () => window.removeEventListener('balruno:open-dedupe', handler);
  }, []);

  // Refs
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // Derived state
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;
  const currentSheet = currentProject?.sheets.find((s) => s.id === currentSheetId) || null;
  const currentDoc = currentProject?.docs?.find((d) => d.id === currentDocId) || null;
  const isModalOpen = showOnboarding || showReferences || showExportModal || showImportModal;

  // Track projects that have shown tour (using project creation time as marker)
  const shownToursRef = useRef<Set<string>>(new Set());

  // Initial data load — Y.Doc hydrate 는 useYDocSync 가 projects 변경에 반응해 자동 처리
  useEffect(() => {
    // 에러 리포팅 초기화 — NEXT_PUBLIC_SENTRY_DSN 설정 시에만 Sentry 활성
    initErrorReporting();

    const init = async () => {
      try {
        const savedProjects = await loadProjects();
        if (savedProjects.length > 0) {
          setProjects(savedProjects);
        } else {
          // Notion 식 — 첫 진입 (저장된 프로젝트 0개) 시 starter pack 자동 시드.
          // localStorage 의 'balruno:starter-seeded' 로 1회만 실행 (사용자가 모두 지운 후 다시 안 만들도록).
          const seededKey = 'balruno:starter-seeded';
          const seeded = typeof window !== 'undefined' ? localStorage.getItem(seededKey) : '1';
          if (!seeded) {
            createProject('튜토리얼', undefined, { seedStarter: true });
            if (typeof window !== 'undefined') {
              localStorage.setItem(seededKey, '1');
              // starter 시드 사용자에겐 onboarding/persona/intro 모달 모두 자동 skip
              // — 튜토리얼 시트 + Welcome doc 이 첫 사용자 가이드 역할 대신함.
              localStorage.setItem('balruno_onboarding_completed', 'starter-seed');
              try {
                const { usePersona } = await import('@/stores/personaStore');
                usePersona.getState().dismissModal();
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [setProjects, createProject]);

  // Auto save / 자동 백업 / 변경 디바운스 — useAutoSave hook
  useAutoSave(isLoading, projects);

  // 최근 시트 기록 (CommandPalette 의 "최근" 그룹 + 향후 사이드바용)
  useEffect(() => {
    if (currentProjectId && currentSheetId) {
      recordRecentSheet(currentProjectId, currentSheetId);
    }
  }, [currentProjectId, currentSheetId]);

  // 모달 오픈 이벤트 (WelcomeScreen / Sidebar / CommandPalette 등에서 dispatch)
  useGlobalEvents({
    onOpenImport: () => setShowImportModal(true),
    onOpenExport: () => setShowExportModal(true),
    onOpenAISetup: () => setShowAISetup(true),
    onOpenShare: () => setShowShare(true),
    onOpenShortcuts: () => setShowShortcutsHelp(true),
    onOpenGallery: () => setShowGallery(true),
    onOpenSettings: () => setShowSettings(true),
    onOpenAICopilot: () => setShowAICopilot(true),
    onSetView: (view: string) => {
      if (currentProjectId && currentSheetId) {
        updateSheet(currentProjectId, currentSheetId, { activeView: view as never });
      }
    },
  });

  // URL `?room=xxx&project=yyy` 자동 감지 → webrtc 연결 + 필요 시 placeholder 프로젝트
  // 생성 (Cross-machine bootstrap). 로컬에 projectId 가 이미 있으면 그대로, 없으면 빈
  // 프로젝트를 Zustand 에 추가 → useYDocSync 가 Y.Doc 초기화 → peers 가 full hydrate.
  // 세션당 1 회만 (sessionStorage 플래그).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const room = url.searchParams.get('room');
    const remoteProjectId = url.searchParams.get('project');
    if (!room) return;

    const sessionKey = `balruno:bootstrapped-${room}`;
    if (window.sessionStorage.getItem(sessionKey) === '1') return;

    const state = useProjectStore.getState();
    let targetProjectId: string | null = remoteProjectId ?? currentProjectId;

    // 로컬에 없는 remote projectId 면 placeholder 생성 (bootstrap)
    if (remoteProjectId && !state.projects.find((p) => p.id === remoteProjectId)) {
      const now = Date.now();
      state.loadProjects([
        ...state.projects,
        {
          id: remoteProjectId,
          name: '공유 프로젝트 (동기화 중…)',
          description: '',
          createdAt: now,
          updatedAt: now,
          sheets: [],
          syncMode: 'cloud',
          syncRoomId: room,
        },
      ]);
      state.setCurrentProject(remoteProjectId);
      targetProjectId = remoteProjectId;
    }

    if (!targetProjectId) return;
    window.sessionStorage.setItem(sessionKey, '1');

    // 동적 import 로 lib/ydoc 접근 (서버 번들 분리)
    import('@/lib/ydoc').then(({ attachWebrtc }) => {
      attachWebrtc(targetProjectId!, room);
    });
  }, [currentProjectId]);

  // 전역 단축키 — Linear 수준 키보드 조작감
  useGlobalKeybinds({
    toggleCommandPalette: () => setShowCommandPalette((v) => !v),
    toggleShortcutsHelp: () => setShowShortcutsHelp((v) => !v),
    onNewProject: () => createProject(t('sidebar.newProject')),
    onNewSheet: () => {
      if (currentProjectId) createSheet(currentProjectId, t('sheet.newSheet'));
    },
    onToggleTheme: toggleTheme,
  });

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

  // Start tour for sample projects when first opened.
  // 온보딩 중복 방지: OnboardingGuide 열려있으면 tour 자동 실행 X (사용자가 닫은 후에만).
  useEffect(() => {
    if (!currentProject || !currentSheet || isLoading) return;
    if (showOnboarding) return; // OnboardingGuide 와 동시 실행 방지

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
  }, [currentProject, currentSheet, isLoading, startTour, showOnboarding]);

  // Sidebar callbacks — 도킹 모드에서는 각 도구의 show state 토글만
  const toggle = (id: keyof typeof toolPanels) => () => toolPanels[id].setShow(!toolPanels[id].show);
  const sidebarCallbacks = {
    onShowHelp: () => setShowOnboarding(true),
    onShowReferences: () => setShowReferences(true),
    onShowSettings: () => setShowSettings(true),
    onShowExportModal: () => setShowExportModal(true),
    onShowImportModal: () => setShowImportModal(true),
    onShowCalculator: toggle('calculator'),
    onShowComparison: toggle('comparison'),
    onShowChart: toggle('chart'),
    onShowPresetComparison: toggle('preset'),
    onShowImbalanceDetector: toggle('imbalance'),
    onShowGoalSolver: toggle('goal'),
    onShowBalanceAnalysis: toggle('balance'),
    onShowEconomy: toggle('economy'),
    onShowDpsVariance: toggle('dpsVariance'),
    onShowCurveFitting: toggle('curveFitting'),
    onToggleFormulaHelper: toggle('formulaHelper'),
    onToggleBalanceValidator: toggle('balanceValidator'),
    onToggleDifficultyCurve: toggle('difficultyCurve'),
    onToggleSimulation: toggle('simulation'),
    onToggleEntityDefinition: toggle('entityDefinition'),
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
      {/* Mobile Header + 조회 전용 안내 배너 */}
      <MobileHeader onMenuClick={() => setShowMobileSidebar(true)} />
      <MobileNotice />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
        callbacks={{
          ...sidebarCallbacks,
          // 모바일에서는 패널 열고 사이드바 닫기 (한 번에)
          onShowChart: () => { toolPanels.chart.setShow(true); setShowMobileSidebar(false); },
          onShowHelp: () => { setShowOnboarding(true); setShowMobileSidebar(false); },
          onShowCalculator: () => { toolPanels.calculator.setShow(true); setShowMobileSidebar(false); },
          onShowComparison: () => { toolPanels.comparison.setShow(true); setShowMobileSidebar(false); },
          onShowReferences: () => { setShowReferences(true); setShowMobileSidebar(false); },
          onShowPresetComparison: () => { toolPanels.preset.setShow(true); setShowMobileSidebar(false); },
          onShowImbalanceDetector: () => { toolPanels.imbalance.setShow(true); setShowMobileSidebar(false); },
          onShowGoalSolver: () => { toolPanels.goal.setShow(true); setShowMobileSidebar(false); },
          onShowBalanceAnalysis: () => { toolPanels.balance.setShow(true); setShowMobileSidebar(false); },
          onShowEconomy: () => { toolPanels.economy.setShow(true); setShowMobileSidebar(false); },
          onShowDpsVariance: () => { toolPanels.dpsVariance.setShow(true); setShowMobileSidebar(false); },
          onShowCurveFitting: () => { toolPanels.curveFitting.setShow(true); setShowMobileSidebar(false); },
          onShowSettings: () => { setShowSettings(true); setShowMobileSidebar(false); },
          onShowExportModal: () => { setShowExportModal(true); setShowMobileSidebar(false); },
          onShowImportModal: () => { setShowImportModal(true); setShowMobileSidebar(false); },
          onToggleFormulaHelper: () => { toolPanels.formulaHelper.setShow(true); setShowMobileSidebar(false); },
          onToggleBalanceValidator: () => { toolPanels.balanceValidator.setShow(true); setShowMobileSidebar(false); },
          onToggleDifficultyCurve: () => { toolPanels.difficultyCurve.setShow(true); setShowMobileSidebar(false); },
          onToggleSimulation: () => { toolPanels.simulation.setShow(true); setShowMobileSidebar(false); },
          onToggleEntityDefinition: () => { toolPanels.entityDefinition.setShow(true); setShowMobileSidebar(false); },
        }}
        activeTools={{
          calculator: toolPanels.calculator.show,
          comparison: toolPanels.comparison.show,
          chart: toolPanels.chart.show,
          presetComparison: toolPanels.preset.show,
          imbalanceDetector: toolPanels.imbalance.show,
          goalSolver: toolPanels.goal.show,
          balanceAnalysis: toolPanels.balance.show,
          economy: toolPanels.economy.show,
          dpsVariance: toolPanels.dpsVariance.show,
          curveFitting: toolPanels.curveFitting.show,
          formulaHelper: toolPanels.formulaHelper.show,
          balanceValidator: toolPanels.balanceValidator.show,
          difficultyCurve: toolPanels.difficultyCurve.show,
          simulation: toolPanels.simulation.show,
          entityDefinition: toolPanels.entityDefinition.show,
        }}
      />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          {...sidebarCallbacks}
          activeTools={{
            calculator: toolPanels.calculator.show,
            comparison: toolPanels.comparison.show,
            chart: toolPanels.chart.show,
            presetComparison: toolPanels.preset.show,
            imbalanceDetector: toolPanels.imbalance.show,
            goalSolver: toolPanels.goal.show,
            balanceAnalysis: toolPanels.balance.show,
            economy: toolPanels.economy.show,
            dpsVariance: toolPanels.dpsVariance.show,
            curveFitting: toolPanels.curveFitting.show,
            formulaHelper: toolPanels.formulaHelper.show,
            balanceValidator: toolPanels.balanceValidator.show,
            difficultyCurve: toolPanels.difficultyCurve.show,
            simulation: toolPanels.simulation.show,
            entityDefinition: toolPanels.entityDefinition.show,
          }}
        />
      </div>

      {/* Sidebar Resizer */}
      <SidebarResizer />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {currentProject ? (
          <>
            <div
              className="flex items-center justify-between border-b"
              style={{
                borderColor: 'var(--border-primary)',
                // SheetTabs 와 같은 톤으로 통일 (이전엔 우측에 배경이 없어 투톤 현상)
                background: 'var(--bg-tertiary)',
              }}
            >
              <div className="flex-1 min-w-0">
                <SheetTabs project={currentProject} />
              </div>
              <div className="flex-shrink-0 hidden md:flex items-center gap-1 px-3">
                <PresenceIndicator projectId={currentProject.id} />
                <button
                  onClick={() => setShowShare(true)}
                  className="px-3 py-1 text-xs rounded-lg font-medium transition-colors hover:opacity-90"
                  style={{ background: 'var(--accent)', color: 'white' }}
                  title="협업 공유"
                >
                  공유
                </button>
                <ProjectMenu
                  onShowExport={() => setShowExportModal(true)}
                  onShowImport={() => setShowImportModal(true)}
                  onShowHelp={() => setShowOnboarding(true)}
                  onShowReferences={() => setShowReferences(true)}
                />
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {currentSheet ? (
                <div
                  ref={sheetContainerRef}
                  className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 pb-[140px] min-h-0 overflow-hidden relative"
                >
                  <StickerLayer containerRef={sheetContainerRef} />

                  <SheetHeader
                    sheet={currentSheet}
                  />

                  {/* PM 시트 (kind='pm' 또는 auto-detect) 전용 상태·우선순위·담당자 요약 배지 */}
                  <PmBadgeStrip sheet={currentSheet} />

                  {/* 뷰 스위처 (저장된 뷰 + 기본 뷰 6종) */}
                  <ViewSwitcher
                    projectId={currentProject.id}
                    sheet={currentSheet}
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
                        case 'diagram':
                          // legacy: 경제 워크벤치로 이관된 뷰. 기존 데이터 보존 위해 조용히 grid 로 폴백.
                          return <SheetTable projectId={currentProject.id} sheet={currentSheet} onAddMemo={handleAddMemo} />;
                      }
                    })()}
                  </div>
                </div>
              ) : currentDoc ? (
                <div className="flex-1 min-w-0 flex flex-col">
                  <DocView
                    projectId={currentProject.id}
                    doc={currentDoc}
                    onClose={() => setCurrentDoc(null)}
                  />
                </div>
              ) : (
                <HomeScreen />
              )}
            </div>
          </>
        ) : (
          <HomeScreen />
        )}
      </div>

      {/* AI Copilot Panel (overlay) */}
      {showAICopilot && <AICopilotPanel onClose={() => setShowAICopilot(false)} />}

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
      {showAISetup && <AISetupModal onClose={() => setShowAISetup(false)} />}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
      {showGallery && <ProjectGalleryModal onClose={() => setShowGallery(false)} />}

      {/* Docked Toolbox — 우측 사이드 도킹 + 하단 독바. usePanelStates hook 으로 단일화. */}
      <DockedToolbox panels={toolPanels} />
      <BottomDock panels={toolPanels} isModalOpen={isModalOpen} />

      {/* 전역 레코드 상세 슬라이드 — 그리드 뷰에서 RowContextMenu "레코드 상세" 로 open */}
      <GlobalRecordDetail />

      {/* 전역 Inbox — 사이드바 Inbox 버튼 or 추후 단축키로 open */}
      <InboxPanel />

      {/* 첫 진입 시 1 회 페르소나 선택 — hasChosen=false 일 때만 내부적으로 렌더 */}
      <PersonaModal />

      {/* 앱 소개 — persona 선택 후 최초 1 회 자동, 이후 WorkspaceSwitcher 에서 재접근 */}
      <ProductIntroModal />

      {/* Command Palette (⌘K) */}
      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* 키보드 단축키 (⌘/) */}
      <KeyboardShortcuts open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

      {/* 중복 프로젝트 정리 */}
      <ProjectDedupeModal isOpen={showDedupeModal} onClose={() => setShowDedupeModal(false)} />

      {/* Interactive Tour */}
      <InteractiveTour tableContainerRef={sheetContainerRef} />

      {/* 전역 Toast */}
      <ToastContainer />
    </main>
  );
}
