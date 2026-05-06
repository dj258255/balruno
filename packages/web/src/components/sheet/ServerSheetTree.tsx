'use client';

/**
 * Server-canonical sheet_tree sidebar — Notion-style nested folder
 * + sheet leaves (ADR 0011 / ADR 0020 Stage D minimal).
 *
 * Receives the project.sheetTree array (TreeNode[]) and a callback
 * for sheet selection. Folders expand/collapse; sheet leaves are
 * clickable. Drag-and-drop reparent is a follow-up (Stage D.2).
 *
 * Tree depth is unbounded in spec but in practice 2-3 levels max
 * for the starter pack (folder → sheets). Recursive render is fine
 * at this scale; if performance becomes an issue, virtualisation
 * (react-arborist) is the standard upgrade.
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, FilePlus, FileSpreadsheet, Folder, FolderPlus, LayoutTemplate, Trash2 } from 'lucide-react';
import type { TreeNode } from '@balruno/shared';

interface ServerSheetTreeProps {
  tree: TreeNode[];
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
  /** Double-click on a node enters rename mode; commit via Enter or blur. */
  onRenameNode?: (nodeId: string, newName: string) => void;
  /** Click "+ 폴더" header button to add a root-level folder. */
  onAddFolder?: () => void;
  /** Click "+ 시트" header button to add a root-level sheet leaf.
   *  Backend's tree.add(type=sheet) creates the matching empty
   *  Sheet body in the same transaction (ADR 0008 v2.1). */
  onAddSheet?: () => void;
  /** Click "+ 템플릿" header button to open the starter pack picker.
   *  Backend mutates atomically + broadcasts sync.full, so the bridge
   *  handles the re-hydrate (ADR 0020 Stage F). */
  onAddFromTemplate?: () => void;
  /** Click trash icon on a folder row to delete it (cascade descendants). */
  onDeleteFolder?: (nodeId: string) => void;
  /**
   * Drag the node and drop on a folder (append to its children) or
   * a sibling (insert before/after based on mouse Y). Native HTML5
   * drag-and-drop — desktop-first, no lib dependency. Touch / mobile
   * upgrade lands when react-arborist or dnd-kit is brought in.
   */
  onMoveNode?: (nodeId: string, newParentId: string | null, newPosition: number) => void;
}

// Native HTML5 dataTransfer mime — chosen specific so we don't grab
// drags from outside the tree.
const DRAG_MIME = 'application/x-balruno-treenode';

export function ServerSheetTree({
  tree,
  selectedSheetId,
  onSelectSheet,
  onRenameNode,
  onAddFolder,
  onAddSheet,
  onAddFromTemplate,
  onDeleteFolder,
  onMoveNode,
}: ServerSheetTreeProps) {
  const showHeader = onAddFolder || onAddSheet || onAddFromTemplate;
  return (
    <div>
      {showHeader && (
        <div className="mb-1 flex justify-end gap-1 px-2">
          {onAddFromTemplate && (
            <button
              type="button"
              onClick={onAddFromTemplate}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-tertiary)' }}
              title="템플릿에서 가져오기"
            >
              <LayoutTemplate className="h-3 w-3" />
              템플릿
            </button>
          )}
          {onAddSheet && (
            <button
              type="button"
              onClick={onAddSheet}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-tertiary)' }}
              title="새 시트"
            >
              <FilePlus className="h-3 w-3" />
              시트
            </button>
          )}
          {onAddFolder && (
            <button
              type="button"
              onClick={onAddFolder}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-tertiary)' }}
              title="새 폴더"
            >
              <FolderPlus className="h-3 w-3" />
              폴더
            </button>
          )}
        </div>
      )}
      {tree.length === 0 ? (
        <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          시트 트리가 비어있습니다.
        </p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {tree.map((node, idx) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              parentId={null}
              indexInParent={idx}
              selectedSheetId={selectedSheetId}
              onSelectSheet={onSelectSheet}
              onRenameNode={onRenameNode}
              onDeleteFolder={onDeleteFolder}
              onMoveNode={onMoveNode}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  parentId: string | null;
  indexInParent: number;
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onDeleteFolder?: (nodeId: string) => void;
  onMoveNode?: (nodeId: string, newParentId: string | null, newPosition: number) => void;
}

type DragHover = 'none' | 'before' | 'after' | 'inside';

function TreeNodeRow({
  node,
  depth,
  parentId,
  indexInParent,
  selectedSheetId,
  onSelectSheet,
  onRenameNode,
  onDeleteFolder,
  onMoveNode,
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(node.name);
  const [dragHover, setDragHover] = useState<DragHover>('none');
  const isFolder = node.type === 'folder';
  const isSheet = node.type === 'sheet';
  const isSelected = isSheet && node.id === selectedSheetId;
  const indent = depth * 12;

  const toggle = () => {
    if (renaming) return;
    if (isFolder) setExpanded((v) => !v);
    else if (isSheet) onSelectSheet(node.id);
  };

  const startRename = () => {
    if (!onRenameNode) return;
    setDraftName(node.name);
    setRenaming(true);
  };

  const commitRename = () => {
    setRenaming(false);
    const next = draftName.trim();
    if (!next || next === node.name) return;
    onRenameNode?.(node.id, next);
  };

  const cancelRename = () => {
    setRenaming(false);
    setDraftName(node.name);
  };

  // Native HTML5 drag wiring. dragstart on the row stamps a custom
  // mime + nodeId; dragover decides the hover region (before /
  // after / inside-folder) by mouse Y; drop emits the move op.
  const handleDragStart = (e: React.DragEvent) => {
    if (!onMoveNode || renaming) return;
    e.dataTransfer.setData(DRAG_MIME, node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!onMoveNode) return;
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (isFolder && y > h * 0.25 && y < h * 0.75) {
      setDragHover('inside');
    } else if (y < h / 2) {
      setDragHover('before');
    } else {
      setDragHover('after');
    }
  };

  const handleDragLeave = () => setDragHover('none');

  const handleDrop = (e: React.DragEvent) => {
    if (!onMoveNode) return;
    const draggedId = e.dataTransfer.getData(DRAG_MIME);
    if (!draggedId || draggedId === node.id) {
      setDragHover('none');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const where = dragHover;
    setDragHover('none');
    if (where === 'inside' && isFolder) {
      const childCount = node.children?.length ?? 0;
      onMoveNode(draggedId, node.id, childCount);
    } else if (where === 'before') {
      onMoveNode(draggedId, parentId, indexInParent);
    } else if (where === 'after') {
      onMoveNode(draggedId, parentId, indexInParent + 1);
    }
  };

  return (
    <li>
      <div
        draggable={!!onMoveNode && !renaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDoubleClick={startRename}
        className="group flex w-full items-center gap-1 rounded px-2 py-1 hover:bg-[var(--bg-hover)]"
        style={{
          paddingLeft: `${8 + indent}px`,
          background: isSelected ? 'var(--bg-selected, var(--bg-hover))' : undefined,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderTop: dragHover === 'before' ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
          borderBottom: dragHover === 'after' ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
          outline: dragHover === 'inside' ? '2px solid var(--accent, #3b82f6)' : undefined,
        }}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-1 text-left"
        >
          {isFolder ? (
            <>
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            </>
          ) : (
            <FileSpreadsheet
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--text-tertiary)', marginLeft: 14 }}
            />
          )}
          {renaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                else if (e.key === 'Escape') cancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded border bg-[var(--bg-secondary)] px-1 text-sm"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </button>
        {isFolder && onDeleteFolder && !renaming && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`폴더 "${node.name}"과 그 안 시트들을 삭제할까요?`)) {
                onDeleteFolder(node.id);
              }
            }}
            className="opacity-0 transition group-hover:opacity-100"
            title="폴더 삭제"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isFolder && expanded && node.children && node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child, idx) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              parentId={node.id}
              indexInParent={idx}
              selectedSheetId={selectedSheetId}
              onSelectSheet={onSelectSheet}
              onRenameNode={onRenameNode}
              onDeleteFolder={onDeleteFolder}
              onMoveNode={onMoveNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
