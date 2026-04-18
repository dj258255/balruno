'use client';

import { useTranslations } from 'next-intl';
import { deleteProjectFromDB } from '@/lib/storage';
import { AllToolId } from '@/stores/toolLayoutStore';
import { useSheetUIStore } from '@/stores/sheetUIStore';

// 분리된 훅과 컴포넌트들
import { useSidebarState, useSidebarDragDrop } from './sidebar/hooks';
import {
  SidebarHeader,
  NewProjectForm,
  ProjectList,
  SidebarFooter,
  DataButtons,
  HelpButtons,
  SaveStatus,
  SheetContextMenu,
  ProjectContextMenu,
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
    toolsContainerRef,
    sheetContextMenuRef,
    projectContextMenuRef,
    toggleProject,
    handleCreateProject,
    handleStartEdit,
    handleFinishEdit,
    handleToolsResizeStart,
  } = state;

  const {
    handleToolDragStart,
    handleToolsSectionDragOver,
    handleToolsSectionDragLeave,
    handleToolsDrop,
    getToolTransformY,
  } = useSidebarDragDrop({
    dragState,
    setDragState,
    toolsContainerRef,
    getSidebarTools: toolLayoutStore.getSidebarTools,
    reorderSidebarTools: toolLayoutStore.reorderSidebarTools,
    moveToolToLocation: toolLayoutStore.moveToolToLocation,
    isResizingToolsSection,
    setIsResizingToolsSection,
    toolsResizeStartY,
    toolsResizeStartHeight,
    setToolsSectionHeight: toolLayoutStore.setToolsSectionHeight,
    sheetContextMenu,
    sheetContextMenuRef,
    setSheetContextMenu: () => setSheetContextMenu(null),
    projectContextMenu,
    projectContextMenuRef,
    setProjectContextMenu: () => setProjectContextMenu(null),
  });

  // 도구 클릭 핸들러 매핑
  const toolClickHandlers: Record<string, (() => void) | undefined> = {
    calculator: onShowCalculator,
    comparison: onShowComparison,
    chart: onShowChart,
    presetComparison: onShowPresetComparison,
    imbalanceDetector: onShowImbalanceDetector,
    goalSolver: onShowGoalSolver,
    balanceAnalysis: onShowBalanceAnalysis,
    economy: onShowEconomy,
    dpsVariance: onShowDpsVariance,
    curveFitting: onShowCurveFitting,
    formulaHelper: onToggleFormulaHelper,
    balanceValidator: onToggleBalanceValidator,
    difficultyCurve: onToggleDifficultyCurve,
    simulation: onToggleSimulation,
    entityDefinition: onToggleEntityDefinition,
  };

  // 모바일에서는 모든 도구 표시
  const sidebarTools = isMobile ? toolLayoutStore.getAllTools() : toolLayoutStore.getSidebarTools();

  return (
    <>
      {/* 도구 섹션 리사이즈 중 오버레이 */}
      {isResizingToolsSection && (
        <div className="fixed inset-0 z-50" style={{ cursor: 'ns-resize' }} />
      )}

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
        />

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

        <DataButtons
          onShowExportModal={onShowExportModal}
          onShowImportModal={onShowImportModal}
        />

        <HelpButtons
          onShowHelp={onShowHelp}
          onShowReferences={onShowReferences}
        />

        <SaveStatus
          lastSaved={projectStore.lastSaved}
          onShowSettings={onShowSettings}
        />
      </div>

      {/* 컨텍스트 메뉴들 */}
      <SheetContextMenu
        menu={sheetContextMenu}
        menuRef={sheetContextMenuRef}
        onRename={(sheetId, sheetName) => {
          setEditingSheetId(sheetId);
          setEditSheetName(sheetName);
        }}
        onEditClassName={(sheetId, className) => {
          setEditingClassNameSheetId(sheetId);
          setEditClassName(className || '');
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
      />
    </>
  );
}
