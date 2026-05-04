import { useState, useRef, useEffect } from 'react';
import { FolderPlus, LayoutTemplate } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { deleteProjectFromDB } from '@/lib/storage';
import { AllToolId } from '@/stores/toolLayoutStore';
import { useSheetUIStore } from '@/stores/sheetUIStore';
import { useSidebarPrefs } from '@/stores/sidebarPrefsStore';
import type { ProjectVisibility } from '@/types';
import { getIncompatibleColumnTypes } from '@/lib/columnTypeMeta';
import SheetTagsModal from '@/components/modals/SheetTagsModal';

// 분리된 훅과 컴포넌트들
import { useSidebarState } from './sidebar/hooks';
import {
  WorkspaceSwitcher,
  PinnedSection,
  NewProjectForm,
  ProjectList,
  SidebarFooter,
  SidebarQuickAccess,
  SidebarDocsSection,
  SaveStatus,
  SheetContextMenu,
  ProjectContextMenu,
  FolderContextMenu,
  ClassNameEditModal,
  ConfirmDialogs,
  KindChangeBlockedDialog,
} from './sidebar/components';
import type { KindChangeBlockedState } from './sidebar/components';

interface SidebarProps {
  onShowChart: () => void;
  onShowHelp: () => void;
  onShowCalculator: () => void;
  onShowComparison: () => void;
  onShowReferences: () => void;
  onShowPresetComparison?: () => void;
  onShowImbalanceDetector?: () => void;
  onShowGoalSolver?: () => void;
  onShowBalanceAnalysis?: () => void;
  onShowEconomy?: () => void;
  onShowDpsVariance?: () => void;
  onShowCurveFitting?: () => void;
  onShowSettings?: () => void;
  onShowExportModal?: () => void;
  onShowImportModal?: () => void;
  onToggleFormulaHelper?: () => void;
  onToggleBalanceValidator?: () => void;
  onToggleDifficultyCurve?: () => void;
  onToggleSimulation?: () => void;
  onToggleEntityDefinition?: () => void;
  activeTools?: {
    calculator?: boolean;
    comparison?: boolean;
    chart?: boolean;
    presetComparison?: boolean;
    imbalanceDetector?: boolean;
    goalSolver?: boolean;
    balanceAnalysis?: boolean;
    economy?: boolean;
    dpsVariance?: boolean;
    curveFitting?: boolean;
    formulaHelper?: boolean;
    balanceValidator?: boolean;
    difficultyCurve?: boolean;
    simulation?: boolean;
    entityDefinition?: boolean;
  };
}

export default function Sidebar({
  onShowChart,
  onShowHelp,
  onShowCalculator,
  onShowComparison,
  onShowReferences,
  onShowPresetComparison,
  onShowImbalanceDetector,
  onShowGoalSolver,
  onShowBalanceAnalysis,
  onShowEconomy,
  onShowDpsVariance,
  onShowCurveFitting,
  onShowSettings,
  onShowExportModal,
  onShowImportModal,
  onToggleFormulaHelper,
  onToggleBalanceValidator,
  onToggleDifficultyCurve,
  onToggleSimulation,
  onToggleEntityDefinition,
  activeTools = {},
}: SidebarProps) {
  const t = useTranslations();
  const state = useSidebarState();
  const sidebarPrefs = useSidebarPrefs();

  // 시트 용도 변경 차단 다이얼로그 — 호환되지 않는 컬럼이 있으면 변경을 막고 안내
  const [kindChangeBlocked, setKindChangeBlocked] = useState<KindChangeBlockedState | null>(null);

  // 시트 태그 편집 모달
  const [tagsModal, setTagsModal] = useState<{ projectId: string; sheetId: string } | null>(null);

  // 팀스페이스 스크롤 컨테이너 빈 영역 우클릭 메뉴
  const [emptyAreaMenu, setEmptyAreaMenu] = useState<{ x: number; y: number } | null>(null);
  const emptyAreaMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!emptyAreaMenu) return;
    const onDown = (e: MouseEvent) => {
      if (emptyAreaMenuRef.current && !emptyAreaMenuRef.current.contains(e.target as Node)) {
        setEmptyAreaMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [emptyAreaMenu]);

  // 문서 섹션 높이 — 프로젝트 섹션과의 리사이즈 핸들로 조절. localStorage 저장.
  // 스타일/동작은 SidebarResizer (사이드바↔본문) 와 일관되게 pointer event + 글로벌 cursor 사용.
  const [docsHeight, setDocsHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    const saved = window.localStorage.getItem('balruno:docs-section-height');
    const n = saved ? parseInt(saved, 10) : 240;
    return Number.isFinite(n) && n > 80 ? n : 240;
  });
  const resizeActiveRef = useRef(false);
  const handleDocsResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeActiveRef.current = true;
    const startY = e.clientY;
    const startHeight = docsHeight;
    let latestHeight = docsHeight;
    const onMove = (ev: PointerEvent) => {
      if (!resizeActiveRef.current) return;
      // 핸들은 DocsSection '위' 에 있음 — 위로 드래그하면 문서 커짐
      const delta = startY - ev.clientY;
      latestHeight = Math.max(80, Math.min(600, startHeight + delta));
      setDocsHeight(latestHeight);
    };
    const onUp = () => {
      resizeActiveRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.localStorage.setItem('balruno:docs-section-height', String(latestHeight));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const {
    projectStore,
    toolLayoutStore,
    mounted,
    isMobile,
    effectiveWidth,
    effectiveToolsHeight,
    expandedProjects,
    setExpandedProjects,
    editingProjectId,
    setEditingProjectId,
    editName,
    setEditName,
    showNewProject,
    setShowNewProject,
    newProjectName,
    setNewProjectName,
    editingSheetId,
    setEditingSheetId,
    editSheetName,
    setEditSheetName,
    dragState,
    setDragState,
    draggedSheetIndex,
    setDraggedSheetIndex,
    draggedSheetId,
    setDraggedSheetId,
    dragOverIndex,
    setDragOverIndex,
    dragProjectId,
    setDragProjectId,
    dragOverProjectId,
    setDragOverProjectId,
    draggedProjectIndex,
    setDraggedProjectIndex,
    dragOverProjectIndex,
    setDragOverProjectIndex,
    sheetContextMenu,
    setSheetContextMenu,
    projectContextMenu,
    setProjectContextMenu,
    folderContextMenu,
    setFolderContextMenu,
    editingFolderId,
    setEditingFolderId,
    editFolderName,
    setEditFolderName,
    editingClassNameSheetId,
    setEditingClassNameSheetId,
    editClassName,
    setEditClassName,
    isResizingToolsSection,
    setIsResizingToolsSection,
    toolsResizeStartY,
    toolsResizeStartHeight,
    sheetMoveConfirm,
    setSheetMoveConfirm,
    sheetDeleteConfirm,
    setSheetDeleteConfirm,
    projectDeleteConfirm,
    setProjectDeleteConfirm,
    folderDeleteConfirm,
    setFolderDeleteConfirm,
    toolsContainerRef,
    sheetContextMenuRef,
    projectContextMenuRef,
    folderContextMenuRef,
    toggleProject,
    handleCreateProject,
    handleStartEdit,
    handleFinishEdit,
    handleToolsResizeStart,
  } = state;

  return (
    <>

      <div
        className="flex flex-col h-full border-r shrink-0 transition-opacity duration-150"
        style={{
          width: `${effectiveWidth}px`,
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          opacity: mounted ? 1 : 0,
        }}
      >
        {/* Notion / Linear 공통 패턴 — 별도 앱 로고 없음. WorkspaceSwitcher 가 최상단 앵커
            역할 + 테마 토글 인라인. (앱 브랜드는 브라우저 탭·파비콘·랜딩에서만) */}
        <WorkspaceSwitcher onOpenSettings={onShowSettings} />

        <SidebarQuickAccess />

        <PinnedSection
          onSheetContextMenu={(e, projectId, sheetId, sheetName, exportClassName) => {
            setSheetContextMenu({ x: e.clientX, y: e.clientY, projectId, sheetId, sheetName, exportClassName });
          }}
        />

        {/* 섹션 순서: 새 프로젝트 → 팀스페이스(공유) → Private(개인) → 문서.
            Notion/Linear/Airtable 공통 문법 — 상단 개인 맥락, 중단 팀 공유, 하단 개인 공간. */}
        <NewProjectForm
          showNewProject={showNewProject}
          setShowNewProject={setShowNewProject}
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          onCreateProject={handleCreateProject}
        />

        {/* 팀스페이스 + Private 공통 스크롤 컨테이너.
            빈 영역 우클릭 시 새 프로젝트 / 갤러리 메뉴. child row 들 우클릭은
            자체 onContextMenu 로 처리되고 여기선 스킵. */}
        <div
          className="flex-1 overflow-y-auto"
          onContextMenu={(e) => {
            if (e.target !== e.currentTarget) return;
            e.preventDefault();
            setEmptyAreaMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {(() => {
            // visibility 기준 2 분할 — 기본(없음/'teamspace') 은 teamspace, 명시적 'private' 만 분리
            const teamspaceProjects = projectStore.projects.filter(
              (p) => (p.visibility ?? 'teamspace') === 'teamspace',
            );
            const privateProjects = projectStore.projects.filter((p) => p.visibility === 'private');

            const sharedListProps = {
              currentProjectId: projectStore.currentProjectId,
              currentSheetId: projectStore.currentSheetId,
              expandedProjects,
              editingProjectId,
              editName,
              setEditName,
              editingSheetId,
              editSheetName,
              setEditSheetName,
              draggedProjectIndex,
              dragOverProjectIndex,
              setDraggedProjectIndex,
              setDragOverProjectIndex,
              draggedSheetIndex,
              draggedSheetId,
              dragOverIndex,
              dragProjectId,
              dragOverProjectId,
              setDraggedSheetIndex,
              setDraggedSheetId,
              setDragOverIndex,
              setDragProjectId,
              setDragOverProjectId,
              toggleProject,
              setCurrentProject: projectStore.setCurrentProject,
              setCurrentSheet: projectStore.setCurrentSheet,
              handleFinishEdit,
              setEditingProjectId,
              setEditingSheetId,
              updateSheet: projectStore.updateSheet,
              reorderProjects: projectStore.reorderProjects,
              reorderSheets: projectStore.reorderSheets,
              toggleFolderExpanded: projectStore.toggleFolderExpanded,
              updateFolder: projectStore.updateFolder,
              moveSheetToFolder: projectStore.moveSheetToFolder,
              moveFolderToFolder: projectStore.moveFolderToFolder,
              onSheetContextMenu: (e: React.MouseEvent, projectId: string, sheetId: string, sheetName: string, exportClassName?: string) => {
                setSheetContextMenu({ x: e.clientX, y: e.clientY, projectId, sheetId, sheetName, exportClassName });
              },
              onProjectContextMenu: (e: React.MouseEvent, projectId: string, projectName: string) => {
                setProjectContextMenu({ x: e.clientX, y: e.clientY, projectId, projectName });
              },
              onFolderContextMenu: (e: React.MouseEvent, projectId: string, folderId: string, folderName: string) => {
                setFolderContextMenu({ x: e.clientX, y: e.clientY, projectId, folderId, folderName });
              },
              onSheetMoveConfirm: (fromProjectId: string, toProjectId: string, toProjectName: string, sheetId: string, sheetName: string) => {
                setSheetMoveConfirm({ fromProjectId, toProjectId, toProjectName, sheetId, sheetName });
              },
              onSheetDelete: (projectId: string, sheetId: string, sheetName: string) => {
                setSheetDeleteConfirm({ projectId, sheetId, sheetName });
              },
              onProjectDelete: (projectId: string, projectName: string) => {
                setProjectDeleteConfirm({ projectId, projectName });
              },
              onFolderDelete: (projectId: string, folderId: string, folderName: string) => {
                setFolderDeleteConfirm({ projectId, folderId, folderName });
              },
              editingFolderId,
              setEditingFolderId,
              editFolderName,
              setEditFolderName,
            };

            return (
              <>
                <ProjectList
                  projects={teamspaceProjects}
                  title={t('sidebar.teamspaces')}
                  {...sharedListProps}
                />
                {privateProjects.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <ProjectList
                      projects={privateProjects}
                      title={t('sidebar.private')}
                      hideWhenEmpty
                      {...sharedListProps}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* 프로젝트 / 문서 섹션 사이 리사이즈 핸들 — 얇은 시각 + 넓은 hit area */}
        <div
          onPointerDown={handleDocsResizeStart}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // 기본 높이 240 으로 리셋. 다른 옵션도 한 줄 메뉴로 확장 가능하지만
            // 리사이즈 핸들의 유일한 유의미 액션이 "리셋" 이라 단순히 즉시 리셋.
            setDocsHeight(240);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('balruno:docs-section-height', '240');
            }
          }}
          className="relative h-1 cursor-row-resize shrink-0 group"
          style={{ touchAction: 'none' }}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('sidebar.resizeAriaLabel')}
          title={t('sidebar.resizeTitle')}
        >
          <div className="absolute inset-x-0 -top-1 -bottom-1" />
          <div className="absolute inset-0 transition-colors group-hover:bg-[var(--accent)]" />
        </div>

        {/* 문서 섹션 — 현재 프로젝트의 docs. 리사이즈 핸들로 높이 조절 가능 */}
        <SidebarDocsSection maxHeight={docsHeight} />

        <SidebarFooter
          selectedRowsCount={projectStore.selectedRows.length}
          clearSelectedRows={projectStore.clearSelectedRows}
          lastSaved={projectStore.lastSaved}
          onShowExportModal={onShowExportModal}
          onShowImportModal={onShowImportModal}
          onShowHelp={onShowHelp}
          onShowReferences={onShowReferences}
          onShowSettings={onShowSettings}
          handleToolsResizeStart={handleToolsResizeStart}
        />

        {/* Track후속: 도구는 하단 BottomDock 으로 일원화. 사이드바에서는 제거. */}
        {/* 내보내기/가져오기는 ProjectMenu (시트 탭바 우측 ⋯) 에 통합됨 — 사이드바에서 제거 */}
        {/* 사용가이드 / 참고자료 는 ProjectMenu + CommandPalette 에서 접근 — 사이드바에서 제거 */}

        <SaveStatus
          lastSaved={projectStore.lastSaved}
          onShowSettings={onShowSettings}
        />
      </div>

      {/* 컨텍스트 메뉴들 */}
      <SheetContextMenu
        menu={sheetContextMenu}
        menuRef={sheetContextMenuRef}
        currentKind={(() => {
          if (!sheetContextMenu) return undefined;
          const project = projectStore.projects.find((p) => p.id === sheetContextMenu.projectId);
          return project?.sheets.find((s) => s.id === sheetContextMenu.sheetId)?.kind;
        })()}
        isPinned={sheetContextMenu ? sidebarPrefs.pinnedSheetIds.includes(sheetContextMenu.sheetId) : false}
        onTogglePin={(sheetId) => {
          sidebarPrefs.togglePinSheet(sheetId);
        }}
        onRename={(sheetId, sheetName) => {
          setEditingSheetId(sheetId);
          setEditSheetName(sheetName);
        }}
        onEditClassName={(sheetId, className) => {
          setEditingClassNameSheetId(sheetId);
          setEditClassName(className || '');
        }}
        onEditTags={(projectId, sheetId) => {
          setTagsModal({ projectId, sheetId });
        }}
        onSetKind={(projectId, sheetId, kind) => {
          // 'auto' (kind=undefined) 는 자동 감지로 되돌리는 것이라 항상 허용.
          // 명시 kind 로 변경 시에는 incompatible 컬럼 사전 검사로 데이터 손실 방지.
          if (kind !== undefined) {
            const project = projectStore.projects.find((p) => p.id === projectId);
            const sheet = project?.sheets.find((s) => s.id === sheetId);
            if (sheet) {
              const incompatibleTypes = getIncompatibleColumnTypes(
                sheet.columns.map((c) => c.type),
                kind,
              );
              if (incompatibleTypes.length > 0) {
                const incompatibleColumns = sheet.columns
                  .filter((c) => incompatibleTypes.includes(c.type))
                  .map((c) => ({ id: c.id, name: c.name, type: c.type }));
                setKindChangeBlocked({
                  sheetName: sheet.name,
                  fromKind: sheet.kind,
                  toKind: kind,
                  incompatibleTypes,
                  incompatibleColumns,
                });
                return;
              }
            }
          }
          projectStore.updateSheet(projectId, sheetId, { kind });
        }}
        onDuplicate={(projectId, sheetId) => {
          projectStore.duplicateSheet(projectId, sheetId);
        }}
        onDelete={(projectId, sheetId, sheetName) => {
          setSheetDeleteConfirm({ projectId, sheetId, sheetName });
        }}
        onClose={() => setSheetContextMenu(null)}
      />

      <ProjectContextMenu
        menu={projectContextMenu}
        menuRef={projectContextMenuRef}
        currentVisibility={(() => {
          if (!projectContextMenu) return undefined;
          const project = projectStore.projects.find((p) => p.id === projectContextMenu.projectId);
          return project?.visibility;
        })()}
        onNewSheet={(projectId) => {
          projectStore.createSheet(projectId, t('sheet.newSheet'));
          setExpandedProjects((prev) => new Set([...prev, projectId]));
        }}
        onNewFolder={(projectId) => {
          projectStore.createFolder(projectId, t('folder.newFolder'));
          setExpandedProjects((prev) => new Set([...prev, projectId]));
        }}
        onRename={handleStartEdit}
        onDuplicate={projectStore.duplicateProject}
        onSetVisibility={(projectId: string, visibility: ProjectVisibility) => {
          projectStore.updateProject(projectId, { visibility });
        }}
        onDelete={(projectId, projectName) => {
          setProjectDeleteConfirm({ projectId, projectName });
        }}
        onClose={() => setProjectContextMenu(null)}
      />

      <FolderContextMenu
        menu={folderContextMenu}
        menuRef={folderContextMenuRef}
        onNewSheet={(projectId, folderId) => {
          const newSheetId = projectStore.createSheet(projectId, t('sheet.newSheet'));
          projectStore.moveSheetToFolder(projectId, newSheetId, folderId);
          projectStore.setCurrentSheet(newSheetId);
        }}
        onNewSubfolder={(projectId, parentId) => {
          projectStore.createFolder(projectId, t('folder.newFolder'), parentId);
          // 부모 폴더 펼치기
          if (!projectStore.projects
            .find((p) => p.id === projectId)
            ?.folders?.find((f) => f.id === parentId)?.isExpanded) {
            projectStore.toggleFolderExpanded(projectId, parentId);
          }
        }}
        onRename={(folderId, folderName) => {
          setEditingFolderId(folderId);
          setEditFolderName(folderName);
        }}
        onDelete={(projectId, folderId, folderName) => {
          setFolderDeleteConfirm({ projectId, folderId, folderName });
        }}
        onClose={() => setFolderContextMenu(null)}
      />

      <ClassNameEditModal
        sheetId={editingClassNameSheetId}
        className={editClassName}
        setClassName={setEditClassName}
        onSave={(sheetId, className) => {
          const project = projectStore.projects.find(p => p.sheets.some(s => s.id === sheetId));
          if (project) {
            projectStore.updateSheet(project.id, sheetId, { exportClassName: className || undefined });
          }
          setEditingClassNameSheetId(null);
          setEditClassName('');
        }}
        onClose={() => {
          setEditingClassNameSheetId(null);
          setEditClassName('');
        }}
      />

      <ConfirmDialogs
        sheetMoveConfirm={sheetMoveConfirm}
        setSheetMoveConfirm={() => setSheetMoveConfirm(null)}
        onMoveSheet={projectStore.moveSheetToProject}
        sheetDeleteConfirm={sheetDeleteConfirm}
        setSheetDeleteConfirm={() => setSheetDeleteConfirm(null)}
        onDeleteSheet={projectStore.deleteSheet}
        projectDeleteConfirm={projectDeleteConfirm}
        setProjectDeleteConfirm={() => setProjectDeleteConfirm(null)}
        onDeleteProject={async (projectId) => {
          projectStore.deleteProject(projectId);
          await deleteProjectFromDB(projectId);
        }}
        folderDeleteConfirm={folderDeleteConfirm}
        setFolderDeleteConfirm={() => setFolderDeleteConfirm(null)}
        onDeleteFolder={(projectId, folderId) => {
          projectStore.deleteFolder(projectId, folderId);
        }}
      />

      <KindChangeBlockedDialog
        state={kindChangeBlocked}
        onClose={() => setKindChangeBlocked(null)}
      />

      {tagsModal && (
        <SheetTagsModal
          projectId={tagsModal.projectId}
          sheetId={tagsModal.sheetId}
          onClose={() => setTagsModal(null)}
        />
      )}

      {emptyAreaMenu && (
        <div
          ref={emptyAreaMenuRef}
          className="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg border"
          style={{
            left: emptyAreaMenu.x,
            top: emptyAreaMenu.y,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event('balruno:open-new-project'));
              setEmptyAreaMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <FolderPlus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            {t('sidebar.newProject')}
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event('balruno:open-gallery'));
              setEmptyAreaMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            {t('sidebar.startFromTemplate')}
          </button>
        </div>
      )}
    </>
  );
}
