/**
 * FolderItem - 폴더 아이템 컴포넌트
 */

'use client';

import { useState } from 'react';
import { Folder, ChevronRight, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Folder as FolderType, Sheet } from '@/types';
import { SheetKindBadge } from '@/components/sheet/SheetKindBadge';
import { SheetTagChips } from '@/components/sheet/SheetTagChips';
import DocIconPicker from '@/components/docs/DocIconPicker';

interface FolderItemProps {
  folder: FolderType;
  projectId: string;
  sheets: Sheet[];
  folders: FolderType[];
  currentSheetId: string | null;
  depth: number;

  // 편집 상태
  editingFolderId: string | null;
  editFolderName: string;
  setEditFolderName: (name: string) => void;
  editingSheetId: string | null;
  editSheetName: string;
  setEditSheetName: (name: string) => void;

  // 액션
  toggleFolderExpanded: (projectId: string, folderId: string) => void;
  setCurrentSheet: (sheetId: string) => void;
  setEditingFolderId: (id: string | null) => void;
  setEditingSheetId: (id: string | null) => void;
  updateFolder: (projectId: string, folderId: string, updates: { name?: string }) => void;
  updateSheet: (projectId: string, sheetId: string, updates: { name?: string; icon?: string }) => void;

  // 컨텍스트 메뉴
  onFolderContextMenu: (e: React.MouseEvent, projectId: string, folderId: string, folderName: string) => void;
  onSheetContextMenu: (e: React.MouseEvent, projectId: string, sheetId: string, sheetName: string, exportClassName?: string) => void;

  // 드래그
  onSheetDragStart: (e: React.DragEvent, sheetId: string, folderId: string | undefined) => void;
  onSheetDragEnd: () => void;
  onFolderDrop: (e: React.DragEvent, folderId: string) => void;
  draggedSheetId: string | null;

  // 폴더 드래그
  onFolderDragStart: (e: React.DragEvent, folderId: string, parentId: string | undefined) => void;
  onFolderDragEnd: () => void;
  onFolderDropToFolder: (e: React.DragEvent, targetFolderId: string | null) => void;
  draggedFolderId: string | null;

  // 삭제
  onSheetDelete: (projectId: string, sheetId: string, sheetName: string) => void;
  onFolderDelete: (projectId: string, folderId: string, folderName: string) => void;

  // 태그 필터 — 활성 태그가 있으면 모든 활성 태그를 가진 시트만 통과 (AND)
  sheetMatcher?: (sheet: Sheet) => boolean;
}

export function FolderItem({
  folder,
  projectId,
  sheets,
  folders,
  currentSheetId,
  depth,
  editingFolderId,
  editFolderName,
  setEditFolderName,
  editingSheetId,
  editSheetName,
  setEditSheetName,
  toggleFolderExpanded,
  setCurrentSheet,
  setEditingFolderId,
  setEditingSheetId,
  updateFolder,
  updateSheet,
  onFolderContextMenu,
  onSheetContextMenu,
  onSheetDragStart,
  onSheetDragEnd,
  onFolderDrop,
  draggedSheetId,
  onFolderDragStart,
  onFolderDragEnd,
  onFolderDropToFolder,
  draggedFolderId,
  onSheetDelete,
  onFolderDelete,
  sheetMatcher,
}: FolderItemProps) {
  const t = useTranslations();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFolderDragOver, setIsFolderDragOver] = useState(false);

  // 이 폴더에 속한 시트들 — 구버전 저장 데이터의 id 중복 방어 + tag 필터 적용
  const folderSheets = (() => {
    const seen = new Set<string>();
    return sheets
      .filter(s => s.folderId === folder.id)
      .filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .filter(s => (sheetMatcher ? sheetMatcher(s) : true));
  })();

  // 이 폴더의 하위 폴더들 — 구버전 저장 데이터의 id 중복 방어
  const childFolders = (() => {
    const seen = new Set<string>();
    return folders
      .filter(f => f.parentId === folder.id)
      .filter(f => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
  })();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedSheetId) {
      setIsDragOver(true);
    }
    // 폴더 드래그 시 - 자기 자신이나 자신의 하위로는 드롭 불가
    if (draggedFolderId && draggedFolderId !== folder.id) {
      setIsFolderDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsFolderDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsFolderDragOver(false);

    // 시트 드롭
    if (draggedSheetId) {
      onFolderDrop(e, folder.id);
    }
    // 폴더 드롭 (자기 자신이 아닌 경우)
    if (draggedFolderId && draggedFolderId !== folder.id) {
      onFolderDropToFolder(e, folder.id);
    }
  };

  return (
    <div style={{ marginLeft: `${depth * 12}px` }}>
      {/* 폴더 헤더 */}
      <div
        draggable={editingFolderId !== folder.id}
        onDragStart={(e) => {
          if (editingFolderId === folder.id) return;
          onFolderDragStart(e, folder.id, folder.parentId);
        }}
        onDragEnd={onFolderDragEnd}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors",
          (isDragOver || isFolderDragOver) && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20",
          draggedFolderId === folder.id && "opacity-50"
        )}
        style={{
          background: (isDragOver || isFolderDragOver) ? undefined : 'transparent',
          color: 'var(--text-secondary)',
        }}
        onClick={() => toggleFolderExpanded(projectId, folder.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFolderContextMenu(e, projectId, folder.id, folder.name);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && editingFolderId !== folder.id) {
            e.preventDefault();
            e.stopPropagation();
            onFolderDelete(projectId, folder.id, folder.name);
          }
        }}
        tabIndex={0}
      >

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFolderExpanded(projectId, folder.id);
          }}
          className="p-0.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          {folder.isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <Folder
          className="w-4 h-4 flex-shrink-0"
          style={{ color: folder.color || 'var(--text-tertiary)' }}
        />

        {editingFolderId === folder.id ? (
          <input
            type="text"
            value={editFolderName}
            onChange={(e) => setEditFolderName(e.target.value)}
            onBlur={() => {
              if (editFolderName.trim()) {
                updateFolder(projectId, folder.id, { name: editFolderName.trim() });
              }
              setEditingFolderId(null);
              setEditFolderName('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (editFolderName.trim()) {
                  updateFolder(projectId, folder.id, { name: editFolderName.trim() });
                }
                setEditingFolderId(null);
                setEditFolderName('');
              }
              if (e.key === 'Escape') {
                setEditingFolderId(null);
                setEditFolderName('');
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
          <span className="flex-1 text-sm font-medium truncate">
            {folder.name}
          </span>
        )}

        <span className="text-xs opacity-50">
          {folderSheets.length}
        </span>
      </div>

      {/* 폴더 내용 (펼쳐진 경우) */}
      {folder.isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {/* 하위 폴더들 */}
          {childFolders.map((childFolder) => (
            <FolderItem
              key={childFolder.id}
              folder={childFolder}
              projectId={projectId}
              sheets={sheets}
              folders={folders}
              currentSheetId={currentSheetId}
              depth={depth + 1}
              editingFolderId={editingFolderId}
              editFolderName={editFolderName}
              setEditFolderName={setEditFolderName}
              editingSheetId={editingSheetId}
              editSheetName={editSheetName}
              setEditSheetName={setEditSheetName}
              toggleFolderExpanded={toggleFolderExpanded}
              setCurrentSheet={setCurrentSheet}
              setEditingFolderId={setEditingFolderId}
              setEditingSheetId={setEditingSheetId}
              updateFolder={updateFolder}
              updateSheet={updateSheet}
              onFolderContextMenu={onFolderContextMenu}
              onSheetContextMenu={onSheetContextMenu}
              onSheetDragStart={onSheetDragStart}
              onSheetDragEnd={onSheetDragEnd}
              onFolderDrop={onFolderDrop}
              draggedSheetId={draggedSheetId}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onFolderDropToFolder={onFolderDropToFolder}
              draggedFolderId={draggedFolderId}
              onSheetDelete={onSheetDelete}
              onFolderDelete={onFolderDelete}
              sheetMatcher={sheetMatcher}
            />
          ))}

          {/* 이 폴더의 시트들 */}
          {folderSheets.map((sheet) => (
            <div
              key={sheet.id}
              draggable={editingSheetId !== sheet.id}
              onDragStart={(e) => onSheetDragStart(e, sheet.id, sheet.folderId)}
              onDragEnd={onSheetDragEnd}
              onClick={() => {
                if (editingSheetId !== sheet.id) {
                  setCurrentSheet(sheet.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSheetContextMenu(e, projectId, sheet.id, sheet.name, sheet.exportClassName);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Delete' || e.key === 'Backspace') && editingSheetId !== sheet.id) {
                  e.preventDefault();
                  e.stopPropagation();
                  onSheetDelete(projectId, sheet.id, sheet.name);
                }
              }}
              tabIndex={0}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors group focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              )}
              style={{
                marginLeft: `${(depth + 1) * 12}px`,
                background: currentSheetId === sheet.id ? 'var(--accent)' : 'transparent',
                color: currentSheetId === sheet.id ? 'white' : 'var(--text-primary)',
              }}
            >
              <span
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <DocIconPicker
                  icon={sheet.icon}
                  onChange={(emoji) => updateSheet(projectId, sheet.id, { icon: emoji })}
                  fallbackIcon={FileSpreadsheet}
                  fallbackColor={currentSheetId === sheet.id ? 'white' : 'var(--accent)'}
                  size="sm"
                />
              </span>
              {editingSheetId === sheet.id ? (
                <input
                  type="text"
                  value={editSheetName}
                  onChange={(e) => setEditSheetName(e.target.value)}
                  onBlur={() => {
                    if (editSheetName.trim()) {
                      updateSheet(projectId, sheet.id, { name: editSheetName.trim() });
                    }
                    setEditingSheetId(null);
                    setEditSheetName('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editSheetName.trim()) {
                        updateSheet(projectId, sheet.id, { name: editSheetName.trim() });
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
                  <SheetTagChips sheet={sheet} onAccent={currentSheetId === sheet.id} />
                  <SheetKindBadge sheet={sheet} showDefault onAccent={currentSheetId === sheet.id} />
                </>
              )}
            </div>
          ))}

          {folderSheets.length === 0 && childFolders.length === 0 && (
            <div
              className="text-xs px-2 py-1"
              style={{
                marginLeft: `${(depth + 1) * 12}px`,
                color: 'var(--text-tertiary)'
              }}
            >
              {t('sidebar.emptyFolder')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
