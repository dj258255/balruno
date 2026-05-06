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
import { ChevronRight, ChevronDown, FileSpreadsheet, Folder, FolderPlus, Trash2 } from 'lucide-react';
import type { TreeNode } from '@balruno/shared';

interface ServerSheetTreeProps {
  tree: TreeNode[];
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
  /** Double-click on a node enters rename mode; commit via Enter or blur. */
  onRenameNode?: (nodeId: string, newName: string) => void;
  /** Click "+ 폴더" header button to add a root-level folder. */
  onAddFolder?: () => void;
  /** Click trash icon on a folder row to delete it (cascade descendants). */
  onDeleteFolder?: (nodeId: string) => void;
}

export function ServerSheetTree({
  tree,
  selectedSheetId,
  onSelectSheet,
  onRenameNode,
  onAddFolder,
  onDeleteFolder,
}: ServerSheetTreeProps) {
  return (
    <div>
      {onAddFolder && (
        <div className="mb-1 flex justify-end px-2">
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
        </div>
      )}
      {tree.length === 0 ? (
        <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          시트 트리가 비어있습니다.
        </p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {tree.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              selectedSheetId={selectedSheetId}
              onSelectSheet={onSelectSheet}
              onRenameNode={onRenameNode}
              onDeleteFolder={onDeleteFolder}
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
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onDeleteFolder?: (nodeId: string) => void;
}

function TreeNodeRow({
  node,
  depth,
  selectedSheetId,
  onSelectSheet,
  onRenameNode,
  onDeleteFolder,
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(node.name);
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

  return (
    <li>
      <div
        onDoubleClick={startRename}
        className="group flex w-full items-center gap-1 rounded px-2 py-1 hover:bg-[var(--bg-hover)]"
        style={{
          paddingLeft: `${8 + indent}px`,
          background: isSelected ? 'var(--bg-selected, var(--bg-hover))' : undefined,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
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
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSheetId={selectedSheetId}
              onSelectSheet={onSelectSheet}
              onRenameNode={onRenameNode}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
