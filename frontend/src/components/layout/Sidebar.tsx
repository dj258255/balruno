'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { deleteProjectFromDB } from '@/lib/storage';
import { AllToolId } from '@/stores/toolLayoutStore';
import { useSheetUIStore } from '@/stores/sheetUIStore';

// 분리된 훅과 컴포넌트들
import { useSidebarState } from './sidebar/hooks';
import {
  SidebarHeader,
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
} from './sidebar/components';

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
        <SidebarHeader />

        <SidebarQuickAccess />

        {/* 섹션 순서: 새 프로젝트(생성) → 프로젝트 리스트(컨테이너) → 문서(컨테이너 안 내용)
            Linear/Jira/ClickUp 과 동일한 "컨테이너 → 내용" 정보 계층 */}
        <NewProjectForm
          showNewProject={showNewProject}
          setShowNewProject={setShowNewProject}
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          onCreateProject={handleCreateProject}
        />

        <ProjectList
          projects={projectStore.projects}
          currentProjectId={projectStore.currentProjectId}
          currentSheetId={projectStore.currentSheetId}
          expandedProjects={expandedProjects}
          editingProjectId={editingProjectId}
          editName={editName}
          setEditName={setEditName}
          editingSheetId={editingSheetId}
          editSheetName={editSheetName}
          setEditSheetName={setEditSheetName}
          draggedProjectIndex={draggedProjectIndex}
          dragOverProjectIndex={dragOverProjectIndex}
          setDraggedProjectIndex={setDraggedProjectIndex}
          setDragOverProjectIndex={setDragOverProjectIndex}
          draggedSheetIndex={draggedSheetIndex}
          draggedSheetId={draggedSheetId}
          dragOverIndex={dragOverIndex}
          dragProjectId={dragProjectId}
          dragOverProjectId={dragOverProjectId}
          setDraggedSheetIndex={setDraggedSheetIndex}
          setDraggedSheetId={setDraggedSheetId}
          setDragOverIndex={setDragOverIndex}
          setDragProjectId={setDragProjectId}
          setDragOverProjectId={setDragOverProjectId}
          toggleProject={toggleProject}
          setCurrentProject={projectStore.setCurrentProject}
          setCurrentSheet={projectStore.setCurrentSheet}
          handleFinishEdit={handleFinishEdit}
          setEditingProjectId={setEditingProjectId}
          setEditingSheetId={setEditingSheetId}
          updateSheet={projectStore.updateSheet}
          reorderProjects={projectStore.reorderProjects}
          reorderSheets={projectStore.reorderSheets}
          toggleFolderExpanded={projectStore.toggleFolderExpanded}
          updateFolder={projectStore.updateFolder}
          moveSheetToFolder={projectStore.moveSheetToFolder}
          moveFolderToFolder={projectStore.moveFolderToFolder}
          onSheetContextMenu={(e, projectId, sheetId, sheetName, exportClassName) => {
            setSheetContextMenu({
              x: e.clientX,
              y: e.clientY,
              projectId,
              sheetId,
              sheetName,
              exportClassName,
            });
          }}
          onProjectContextMenu={(e, projectId, projectName) => {
            setProjectContextMenu({
              x: e.clientX,
              y: e.clientY,
              projectId,
              projectName,
            });
          }}
          onFolderContextMenu={(e, projectId, folderId, folderName) => {
            setFolderContextMenu({
              x: e.clientX,
              y: e.clientY,
              projectId,
              folderId,
              folderName,
            });
          }}
          onSheetMoveConfirm={(fromProjectId, toProjectId, toProjectName, sheetId, sheetName) => {
            setSheetMoveConfirm({
              fromProjectId,
              toProjectId,
              toProjectName,
              sheetId,
              sheetName,
            });
          }}
          onSheetDelete={(projectId, sheetId, sheetName) => {
            setSheetDeleteConfirm({ projectId, sheetId, sheetName });
          }}
          onProjectDelete={(projectId, projectName) => {
            setProjectDeleteConfirm({ projectId, projectName });
          }}
          onFolderDelete={(projectId, folderId, folderName) => {
            setFolderDeleteConfirm({ projectId, folderId, folderName });
          }}
          editingFolderId={editingFolderId}
          setEditingFolderId={setEditingFolderId}
          editFolderName={editFolderName}
          setEditFolderName={setEditFolderName}
        />

        {/* 프로젝트 / 문서 섹션 사이 리사이즈 핸들 — 얇은 시각 + 넓은 hit area */}
        <div
          onPointerDown={handleDocsResizeStart}
          className="relative h-1 cursor-row-resize shrink-0 group"
          style={{ touchAction: 'none' }}
          role="separator"
          aria-orientation="horizontal"
          aria-label="프로젝트/문서 영역 크기 조절"
          title="드래그로 문서 섹션 높이 조절"
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

        {/* Track 6 후속: 도구는 하단 BottomDock 으로 일원화. 사이드바에서는 제거. */}
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
        onRename={(sheetId, sheetName) => {
          setEditingSheetId(sheetId);
          setEditSheetName(sheetName);
        }}
        onEditClassName={(sheetId, className) => {
          setEditingClassNameSheetId(sheetId);
          setEditClassName(className || '');
        }}
        onSetKind={(projectId, sheetId, kind) => {
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
    </>
  );
}
