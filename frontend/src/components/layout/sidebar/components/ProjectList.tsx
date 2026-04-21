/**
 * ProjectList - 프로젝트/폴더/시트 목록 컴포넌트
 */

'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { FileSpreadsheet, ChevronRight, ChevronDown, FolderPlus, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { Project, Folder as FolderType } from '@/types';
import { FolderItem } from './FolderItem';
import { SheetKindBadge } from '@/components/sheet/SheetKindBadge';

interface ProjectListProps {
  projects: Project[];
  currentProjectId: string | null;
  currentSheetId: string | null;
  expandedProjects: Set<string>;

  // 편집 상태
  editingProjectId: string | null;
  editName: string;
  setEditName: (name: string) => void;
  editingSheetId: string | null;
  editSheetName: string;
  setEditSheetName: (name: string) => void;

  // 드래그 상태 - 프로젝트
  draggedProjectIndex: number | null;
  dragOverProjectIndex: number | null;
  setDraggedProjectIndex: (index: number | null) => void;
  setDragOverProjectIndex: (index: number | null) => void;

  // 드래그 상태 - 시트
  draggedSheetIndex: number | null;
  draggedSheetId: string | null;
  dragOverIndex: number | null;
  dragProjectId: string | null;
  dragOverProjectId: string | null;
  setDraggedSheetIndex: (index: number | null) => void;
  setDraggedSheetId: (id: string | null) => void;
  setDragOverIndex: (index: number | null) => void;
  setDragProjectId: (id: string | null) => void;
  setDragOverProjectId: (id: string | null) => void;

  // 액션
  toggleProject: (projectId: string) => void;
  setCurrentProject: (projectId: string) => void;
  setCurrentSheet: (sheetId: string) => void;
  handleFinishEdit: () => void;
  setEditingProjectId: (id: string | null) => void;
  setEditingSheetId: (id: string | null) => void;
  updateSheet: (projectId: string, sheetId: string, updates: { name?: string }) => void;
  reorderProjects: (from: number, to: number) => void;
  reorderSheets: (projectId: string, from: number, to: number) => void;

  // 폴더 액션
  toggleFolderExpanded?: (projectId: string, folderId: string) => void;
  updateFolder?: (projectId: string, folderId: string, updates: { name?: string }) => void;
  moveSheetToFolder?: (projectId: string, sheetId: string, folderId: string | null) => void;
  moveFolderToFolder?: (projectId: string, folderId: string, parentId: string | null) => void;

  // 컨텍스트 메뉴
  onSheetContextMenu: (e: React.MouseEvent, projectId: string, sheetId: string, sheetName: string, exportClassName?: string) => void;
  onProjectContextMenu: (e: React.MouseEvent, projectId: string, projectName: string) => void;
  onFolderContextMenu?: (e: React.MouseEvent, projectId: string, folderId: string, folderName: string) => void;

  // 시트 이동 확인
  onSheetMoveConfirm: (from: string, to: string, toName: string, sheetId: string, sheetName: string) => void;

  // 삭제 확인
  onSheetDelete: (projectId: string, sheetId: string, sheetName: string) => void;
  onProjectDelete: (projectId: string, projectName: string) => void;
  onFolderDelete?: (projectId: string, folderId: string, folderName: string) => void;
}

export function ProjectList({
  projects,
  currentProjectId,
  currentSheetId,
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
  setCurrentProject,
  setCurrentSheet,
  handleFinishEdit,
  setEditingProjectId,
  setEditingSheetId,
  updateSheet,
  reorderProjects,
  reorderSheets,
  toggleFolderExpanded,
  updateFolder,
  moveSheetToFolder,
  moveFolderToFolder,
  onSheetContextMenu,
  onProjectContextMenu,
  onFolderContextMenu,
  onSheetMoveConfirm,
  onSheetDelete,
  onProjectDelete,
  onFolderDelete,
}: ProjectListProps) {
  const t = useTranslations();

  // 폴더 편집 상태
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  // 시트 드래그 상태 (폴더 이동용)
  const [draggedSheetForFolder, setDraggedSheetForFolder] = useState<string | null>(null);
  const [draggedSheetFromFolder, setDraggedSheetFromFolder] = useState<string | undefined>(undefined);

  // 폴더 드래그 상태
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedFolderProjectId, setDraggedFolderProjectId] = useState<string | null>(null);

  // 빈 공간 우클릭 컨텍스트 메뉴 (프로젝트/시트 위가 아닌 곳)
  const [emptyMenu, setEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!emptyMenu) return;
    const onDown = () => setEmptyMenu(null);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [emptyMenu]);
  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    // 프로젝트/시트/폴더 행에서는 이미 stopPropagation 하므로 여기 도달하면 진짜 빈 공간.
    e.preventDefault();
    setEmptyMenu({ x: e.clientX, y: e.clientY });
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-2" onContextMenu={handleEmptyContextMenu}>
        {renderEmptyContextMenu(emptyMenu, setEmptyMenu)}
        <div className="text-center py-10 px-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center" style={{
            background: 'var(--accent-light)'
          }}>
            <FileSpreadsheet className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('project.noProject')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('project.createProject')}</p>
        </div>
      </div>
    );
  }

  // 시트 드래그 시작 (폴더 이동용)
  const handleSheetDragStart = (e: React.DragEvent, sheetId: string, folderId: string | undefined) => {
    e.dataTransfer.setData('application/x-sheet-id', sheetId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSheetForFolder(sheetId);
    setDraggedSheetFromFolder(folderId);
  };

  const handleSheetDragEnd = () => {
    setDraggedSheetForFolder(null);
    setDraggedSheetFromFolder(undefined);
  };

  // 폴더에 시트 드롭
  const handleFolderDrop = (e: React.DragEvent, projectId: string, folderId: string) => {
    e.preventDefault();
    const sheetId = e.dataTransfer.getData('application/x-sheet-id');
    if (sheetId && moveSheetToFolder) {
      moveSheetToFolder(projectId, sheetId, folderId);
    }
    setDraggedSheetForFolder(null);
    setDraggedSheetFromFolder(undefined);
  };

  // 루트에 시트 드롭 (폴더에서 꺼내기)
  const handleRootDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    const sheetId = e.dataTransfer.getData('application/x-sheet-id');
    if (sheetId && moveSheetToFolder && draggedSheetFromFolder) {
      moveSheetToFolder(projectId, sheetId, null);
    }
    setDraggedSheetForFolder(null);
    setDraggedSheetFromFolder(undefined);

    // 폴더 드롭 (루트로 이동)
    const folderId = e.dataTransfer.getData('application/x-folder-id');
    if (folderId && moveFolderToFolder && draggedFolderProjectId === projectId) {
      moveFolderToFolder(projectId, folderId, null);
    }
    setDraggedFolderId(null);
    setDraggedFolderProjectId(null);
  };

  // 폴더 드래그 시작
  const handleFolderDragStart = (e: React.DragEvent, projectId: string, folderId: string, parentId: string | undefined) => {
    e.dataTransfer.setData('application/x-folder-id', folderId);
    e.dataTransfer.setData('application/x-folder-project-id', projectId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFolderId(folderId);
    setDraggedFolderProjectId(projectId);
  };

  const handleFolderDragEnd = () => {
    setDraggedFolderId(null);
    setDraggedFolderProjectId(null);
  };

  // 폴더를 다른 폴더로 드롭
  const handleFolderDropToFolder = (e: React.DragEvent, projectId: string, targetFolderId: string | null) => {
    e.preventDefault();
    const folderId = e.dataTransfer.getData('application/x-folder-id');
    const sourceProjectId = e.dataTransfer.getData('application/x-folder-project-id');

    if (folderId && moveFolderToFolder && sourceProjectId === projectId) {
      // 같은 프로젝트 내에서만 이동 (자기 자신이나 하위로는 이동 불가 - store에서 처리)
      if (folderId !== targetFolderId) {
        moveFolderToFolder(projectId, folderId, targetFolderId);
      }
    }
    setDraggedFolderId(null);
    setDraggedFolderProjectId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-2" onContextMenu={handleEmptyContextMenu}>
      {renderEmptyContextMenu(emptyMenu, setEmptyMenu)}
      <div className="space-y-1.5">
        {projects.map((project, projectIndex) => {
          // 루트 레벨 폴더들 (parentId가 없는 것)
          const rootFolders = (project.folders || []).filter(f => !f.parentId);

          // 루트 레벨 시트들 (folderId가 없는 것)
          // 루트 시트 — 과거 저장 데이터의 id 중복 방어 (IndexedDB 에 남은 구버전 데이터 대응)
          const rootSheets = (() => {
            const seen = new Set<string>();
            return project.sheets
              .filter(s => !s.folderId)
              .filter(s => {
                if (seen.has(s.id)) return false;
                seen.add(s.id);
                return true;
              });
          })();

          return (
            <div
              key={project.id}
              draggable={editingProjectId !== project.id}
              onDragStart={(e) => {
                if (editingProjectId === project.id) return;
                e.dataTransfer.setData('application/x-project-index', String(projectIndex));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedProjectIndex(projectIndex);
              }}
              onDragEnd={() => {
                setDraggedProjectIndex(null);
                setDragOverProjectIndex(null);
                setDragOverProjectId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedProjectIndex !== null) {
                  setDragOverProjectIndex(projectIndex);
                }
                if (draggedSheetId && dragProjectId !== project.id) {
                  setDragOverProjectId(project.id);
                }
              }}
              onDragLeave={() => {
                setDragOverProjectIndex(null);
                setDragOverProjectId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedProjectIndex !== null && draggedProjectIndex !== projectIndex) {
                  reorderProjects(draggedProjectIndex, projectIndex);
                }
                if (draggedSheetId && dragProjectId && dragProjectId !== project.id) {
                  const fromProject = projects.find(p => p.id === dragProjectId);
                  const sheet = fromProject?.sheets.find(s => s.id === draggedSheetId);
                  if (sheet) {
                    onSheetMoveConfirm(dragProjectId, project.id, project.name, draggedSheetId, sheet.name);
                  }
                }
                setDraggedProjectIndex(null);
                setDragOverProjectIndex(null);
                setDraggedSheetIndex(null);
                setDraggedSheetId(null);
                setDragProjectId(null);
                setDragOverProjectId(null);
              }}
            >
              {/* 프로젝트 헤더 */}
              <div
                tabIndex={0}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer group transition-colors border focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]',
                  dragOverProjectIndex === projectIndex && 'ring-2 ring-blue-400',
                  dragOverProjectId === project.id && 'ring-2 ring-green-400 bg-green-50 dark:bg-green-900/20'
                )}
                style={{
                  background: dragOverProjectId === project.id
                    ? undefined
                    : currentProjectId === project.id ? 'var(--accent-light)' : 'transparent',
                  color: currentProjectId === project.id ? 'var(--accent)' : 'var(--text-secondary)',
                  borderColor: currentProjectId === project.id ? 'var(--accent)' : 'var(--border-primary)',
                  opacity: draggedProjectIndex === projectIndex ? 0.5 : 1,
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onProjectContextMenu(e, project.id, project.name);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Delete' || e.key === 'Backspace') && editingProjectId !== project.id) {
                    e.preventDefault();
                    e.stopPropagation();
                    onProjectDelete(project.id, project.name);
                  }
                }}
              >
                <button
                  onClick={() => toggleProject(project.id)}
                  className="p-0.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {expandedProjects.has(project.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {editingProjectId === project.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishEdit();
                      if (e.key === 'Escape') {
                        setEditingProjectId(null);
                        setEditName('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-2 py-1 text-sm rounded"
                    autoFocus
                  />
                ) : (
                  <span
                    onClick={() => {
                      setCurrentProject(project.id);
                      if (!expandedProjects.has(project.id)) toggleProject(project.id);
                    }}
                    className="flex-1 text-sm font-medium truncate"
                  >
                    {project.name}
                  </span>
                )}
              </div>

              {/* 프로젝트 내용 */}
              {expandedProjects.has(project.id) && (
                <div
                  className="ml-5 mt-0.5 space-y-0.5"
                  onDragOver={(e) => {
                    // 시트나 폴더를 루트로 드롭할 수 있도록
                    if ((draggedSheetForFolder && draggedSheetFromFolder) ||
                        (draggedFolderId && draggedFolderProjectId === project.id)) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => handleRootDrop(e, project.id)}
                >
                  {/* 루트 폴더들 */}
                  {rootFolders.map((folder) => (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      projectId={project.id}
                      sheets={project.sheets}
                      folders={project.folders || []}
                      currentSheetId={currentSheetId}
                      depth={0}
                      editingFolderId={editingFolderId}
                      editFolderName={editFolderName}
                      setEditFolderName={setEditFolderName}
                      editingSheetId={editingSheetId}
                      editSheetName={editSheetName}
                      setEditSheetName={setEditSheetName}
                      toggleFolderExpanded={toggleFolderExpanded || (() => {})}
                      setCurrentSheet={(sheetId) => {
                        setCurrentSheet(sheetId);
                      }}
                      setEditingFolderId={setEditingFolderId}
                      setEditingSheetId={setEditingSheetId}
                      updateFolder={updateFolder || (() => {})}
                      updateSheet={updateSheet}
                      onFolderContextMenu={onFolderContextMenu || (() => {})}
                      onSheetContextMenu={onSheetContextMenu}
                      onSheetDragStart={handleSheetDragStart}
                      onSheetDragEnd={handleSheetDragEnd}
                      onFolderDrop={(e, folderId) => handleFolderDrop(e, project.id, folderId)}
                      draggedSheetId={draggedSheetForFolder}
                      onFolderDragStart={(e, folderId, parentId) => handleFolderDragStart(e, project.id, folderId, parentId)}
                      onFolderDragEnd={handleFolderDragEnd}
                      onFolderDropToFolder={(e, targetFolderId) => handleFolderDropToFolder(e, project.id, targetFolderId)}
                      draggedFolderId={draggedFolderId}
                      onSheetDelete={onSheetDelete}
                      onFolderDelete={onFolderDelete || (() => {})}
                    />
                  ))}

                  {/* 루트 시트들 */}
                  {rootSheets.map((sheet, index) => (
                    <div
                      key={sheet.id}
                      draggable={editingSheetId !== sheet.id}
                      onDragStart={(e) => {
                        if (editingSheetId === sheet.id) return;
                        setDraggedSheetIndex(index);
                        setDraggedSheetId(sheet.id);
                        setDragProjectId(project.id);
                        handleSheetDragStart(e, sheet.id, sheet.folderId);
                      }}
                      onDragEnd={() => {
                        setDraggedSheetIndex(null);
                        setDraggedSheetId(null);
                        setDragOverIndex(null);
                        setDragProjectId(null);
                        setDragOverProjectId(null);
                        handleSheetDragEnd();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragProjectId === project.id) {
                          setDragOverIndex(index);
                        }
                      }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedSheetIndex !== null && dragProjectId === project.id && draggedSheetIndex !== index) {
                          reorderSheets(project.id, draggedSheetIndex, index);
                        }
                        setDraggedSheetIndex(null);
                        setDraggedSheetId(null);
                        setDragOverIndex(null);
                        setDragProjectId(null);
                      }}
                      onClick={() => {
                        if (editingSheetId !== sheet.id) {
                          setCurrentSheet(sheet.id);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSheetContextMenu(e, project.id, sheet.id, sheet.name, sheet.exportClassName);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Delete' || e.key === 'Backspace') && editingSheetId !== sheet.id) {
                          e.preventDefault();
                          e.stopPropagation();
                          onSheetDelete(project.id, sheet.id, sheet.name);
                        }
                      }}
                      tabIndex={0}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors group focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]",
                        dragOverIndex === index && dragProjectId === project.id && "ring-2 ring-blue-400"
                      )}
                      style={{
                        background: currentSheetId === sheet.id ? 'var(--accent)' :
                                   (draggedSheetIndex === index && dragProjectId === project.id) ? 'var(--bg-tertiary)' : 'transparent',
                        color: currentSheetId === sheet.id ? 'white' : 'var(--text-primary)',
                        opacity: draggedSheetIndex === index && dragProjectId === project.id ? 0.5 : 1,
                      }}
                    >
                      <FileSpreadsheet
                        className="w-4 h-4 flex-shrink-0"
                        style={{
                          color: currentSheetId === sheet.id ? 'white' : 'var(--accent)',
                        }}
                      />
                      {editingSheetId === sheet.id ? (
                        <input
                          type="text"
                          value={editSheetName}
                          onChange={(e) => setEditSheetName(e.target.value)}
                          onBlur={() => {
                            if (editSheetName.trim()) {
                              updateSheet(project.id, sheet.id, { name: editSheetName.trim() });
                            }
                            setEditingSheetId(null);
                            setEditSheetName('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editSheetName.trim()) {
                                updateSheet(project.id, sheet.id, { name: editSheetName.trim() });
                              }
                              setEditingSheetId(null);
                              setEditSheetName('');
                            }
                            if (e.key === 'Escape') {
                              setEditingSheetId(null);
                              setEditSheetName('');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 px-1 py-0.5 text-sm rounded"
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)'
                          }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="truncate flex-1">
                            {sheet.name}
                            {sheet.exportClassName && (
                              <span style={{ color: 'var(--text-tertiary)' }}> | {sheet.exportClassName}</span>
                            )}
                          </span>
                          <SheetKindBadge sheet={sheet} />
                        </>
                      )}
                    </div>
                  ))}

                  {project.sheets.length === 0 && (project.folders || []).length === 0 && (
                    <div className="text-xs px-2 py-1.5" style={{ color: 'var(--text-tertiary)' }}>{t('sidebar.noSheet')}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 사이드바 빈 공간 우클릭 시 뜨는 플로팅 컨텍스트 메뉴.
 * 액션은 전역 이벤트로 전달 — NewProjectForm / ProjectGalleryModal 이 리슨.
 */
function renderEmptyContextMenu(
  menu: { x: number; y: number } | null,
  close: (v: null) => void,
) {
  if (!menu) return null;

  const trigger = (eventName: string) => {
    close(null);
    window.dispatchEvent(new Event(eventName));
  };

  return (
    <div
      className="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-xl border"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => trigger('balruno:open-new-project')}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <FolderPlus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        새 프로젝트
      </button>
      <button
        type="button"
        onClick={() => trigger('balruno:open-gallery')}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        템플릿 갤러리에서 시작
      </button>
    </div>
  );
}
