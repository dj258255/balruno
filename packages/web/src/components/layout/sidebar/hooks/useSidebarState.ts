/**
 * useSidebarState - 사이드바 상태 관리 훅
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useToolLayoutStore, AllToolId } from '@/stores/toolLayoutStore';

// 드래그 상태 타입
export interface ToolDragState {
  draggedToolId: AllToolId | null;
  draggedFromSidebar: boolean;
  dropTargetIndex: number | null;
  isOverSidebar: boolean;
}

// 시트 컨텍스트 메뉴 상태 타입
export interface SheetContextMenuState {
  x: number;
  y: number;
  projectId: string;
  sheetId: string;
  sheetName: string;
  exportClassName?: string;
}

// 프로젝트 컨텍스트 메뉴 상태 타입
export interface ProjectContextMenuState {
  x: number;
  y: number;
  projectId: string;
  projectName: string;
}

// 폴더 컨텍스트 메뉴 상태 타입
export interface FolderContextMenuState {
  x: number;
  y: number;
  projectId: string;
  folderId: string;
  folderName: string;
}

// 폴더 삭제 확인 상태 타입
export interface FolderDeleteConfirmState {
  projectId: string;
  folderId: string;
  folderName: string;
}

// 확인 다이얼로그 상태 타입
export interface SheetMoveConfirmState {
  fromProjectId: string;
  toProjectId: string;
  toProjectName: string;
  sheetId: string;
  sheetName: string;
}

export interface SheetDeleteConfirmState {
  projectId: string;
  sheetId: string;
  sheetName: string;
}

export interface ProjectDeleteConfirmState {
  projectId: string;
  projectName: string;
}

export function useSidebarState() {
  // 스토어
  const projectStore = useProjectStore();
  const toolLayoutStore = useToolLayoutStore();

  // 클라이언트 마운트 상태
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 프로젝트/시트 UI 상태
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState('');

  // 도구 드래그 상태
  const [dragState, setDragState] = useState<ToolDragState>({
    draggedToolId: null,
    draggedFromSidebar: false,
    dropTargetIndex: null,
    isOverSidebar: false,
  });

  // 시트 드래그 상태
  const [draggedSheetIndex, setDraggedSheetIndex] = useState<number | null>(null);
  const [draggedSheetId, setDraggedSheetId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);

  // 프로젝트 드래그 상태
  const [draggedProjectIndex, setDraggedProjectIndex] = useState<number | null>(null);
  const [dragOverProjectIndex, setDragOverProjectIndex] = useState<number | null>(null);

  // 컨텍스트 메뉴 상태
  const [sheetContextMenu, setSheetContextMenu] = useState<SheetContextMenuState | null>(null);
  const [projectContextMenu, setProjectContextMenu] = useState<ProjectContextMenuState | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);

  // 폴더 편집 상태 — rename 을 Sidebar 레벨 컨텍스트 메뉴에서 트리거하려면 여기로 끌어올려야 함
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  // 클래스명 편집 상태
  const [editingClassNameSheetId, setEditingClassNameSheetId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');

  // 도구 섹션 리사이즈 상태
  const [isResizingToolsSection, setIsResizingToolsSection] = useState(false);
  const toolsResizeStartY = useRef(0);
  const toolsResizeStartHeight = useRef(0);

  // 확인 다이얼로그 상태
  const [sheetMoveConfirm, setSheetMoveConfirm] = useState<SheetMoveConfirmState | null>(null);
  const [sheetDeleteConfirm, setSheetDeleteConfirm] = useState<SheetDeleteConfirmState | null>(null);
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState<ProjectDeleteConfirmState | null>(null);
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<FolderDeleteConfirmState | null>(null);

  // 컨테이너 ref
  const toolsContainerRef = useRef<HTMLDivElement>(null);
  const sheetContextMenuRef = useRef<HTMLDivElement>(null);
  const projectContextMenuRef = useRef<HTMLDivElement>(null);
  const folderContextMenuRef = useRef<HTMLDivElement>(null);

  // 컨텍스트 메뉴 3 종 바깥 클릭 시 닫기 — sheet / project / folder 동일 패턴
  useEffect(() => {
    if (!sheetContextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (sheetContextMenuRef.current && !sheetContextMenuRef.current.contains(e.target as Node)) {
        setSheetContextMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sheetContextMenu]);

  useEffect(() => {
    if (!projectContextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (projectContextMenuRef.current && !projectContextMenuRef.current.contains(e.target as Node)) {
        setProjectContextMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [projectContextMenu]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (folderContextMenuRef.current && !folderContextMenuRef.current.contains(e.target as Node)) {
        setFolderContextMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [folderContextMenu]);

  // 클라이언트 마운트 감지
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 계산된 값
  const effectiveWidth = mounted ? toolLayoutStore.sidebarWidth : 256;
  const effectiveToolsHeight = mounted ? toolLayoutStore.toolsSectionHeight : 200;

  // 프로젝트 토글
  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  }, []);

  // 프로젝트 생성
  const handleCreateProject = useCallback(() => {
    if (newProjectName.trim()) {
      const id = projectStore.createProject(newProjectName.trim());
      setExpandedProjects((prev) => new Set([...prev, id]));
      setNewProjectName('');
      setShowNewProject(false);
    }
  }, [newProjectName, projectStore]);

  // 프로젝트 편집 시작
  const handleStartEdit = useCallback((projectId: string, name: string) => {
    setEditingProjectId(projectId);
    setEditName(name);
  }, []);

  // 프로젝트 편집 완료
  const handleFinishEdit = useCallback(() => {
    if (editingProjectId && editName.trim()) {
      projectStore.updateProject(editingProjectId, { name: editName.trim() });
    }
    setEditingProjectId(null);
    setEditName('');
  }, [editingProjectId, editName, projectStore]);

  // 도구 섹션 리사이즈 시작
  const handleToolsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingToolsSection(true);
    toolsResizeStartY.current = e.clientY;
    toolsResizeStartHeight.current = toolLayoutStore.toolsSectionHeight;
  }, [toolLayoutStore.toolsSectionHeight]);

  return {
    // 스토어
    projectStore,
    toolLayoutStore,

    // 마운트 상태
    mounted,
    isMobile,

    // 계산된 값
    effectiveWidth,
    effectiveToolsHeight,

    // 프로젝트/시트 UI 상태
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

    // 도구 드래그 상태
    dragState,
    setDragState,

    // 시트 드래그 상태
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

    // 프로젝트 드래그 상태
    draggedProjectIndex,
    setDraggedProjectIndex,
    dragOverProjectIndex,
    setDragOverProjectIndex,

    // 컨텍스트 메뉴 상태
    sheetContextMenu,
    setSheetContextMenu,
    projectContextMenu,
    setProjectContextMenu,
    folderContextMenu,
    setFolderContextMenu,

    // 폴더 편집 상태
    editingFolderId,
    setEditingFolderId,
    editFolderName,
    setEditFolderName,

    // 클래스명 편집 상태
    editingClassNameSheetId,
    setEditingClassNameSheetId,
    editClassName,
    setEditClassName,

    // 도구 섹션 리사이즈 상태
    isResizingToolsSection,
    setIsResizingToolsSection,
    toolsResizeStartY,
    toolsResizeStartHeight,

    // 확인 다이얼로그 상태
    sheetMoveConfirm,
    setSheetMoveConfirm,
    sheetDeleteConfirm,
    setSheetDeleteConfirm,
    projectDeleteConfirm,
    setProjectDeleteConfirm,
    folderDeleteConfirm,
    setFolderDeleteConfirm,

    // Refs
    toolsContainerRef,
    sheetContextMenuRef,
    projectContextMenuRef,
    folderContextMenuRef,

    // 액션
    toggleProject,
    handleCreateProject,
    handleStartEdit,
    handleFinishEdit,
    handleToolsResizeStart,
  };
}
