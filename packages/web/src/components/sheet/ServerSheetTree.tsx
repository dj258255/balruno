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
import { ChevronRight, ChevronDown, FileSpreadsheet, Folder } from 'lucide-react';
import type { TreeNode } from '@balruno/shared';

interface ServerSheetTreeProps {
  tree: TreeNode[];
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
}

export function ServerSheetTree({
  tree,
  selectedSheetId,
  onSelectSheet,
}: ServerSheetTreeProps) {
  if (tree.length === 0) {
    return (
      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        시트 트리가 비어있습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 text-sm">
      {tree.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          selectedSheetId={selectedSheetId}
          onSelectSheet={onSelectSheet}
        />
      ))}
    </ul>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  selectedSheetId: string | null;
  onSelectSheet: (sheetId: string) => void;
}

function TreeNodeRow({ node, depth, selectedSheetId, onSelectSheet }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(depth === 0); // root folders open by default
  const isFolder = node.type === 'folder';
  const isSheet = node.type === 'sheet';
  const isSelected = isSheet && node.id === selectedSheetId;
  const indent = depth * 12;

  const toggle = () => {
    if (isFolder) setExpanded((v) => !v);
    else if (isSheet) onSelectSheet(node.id);
  };

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-[var(--bg-hover)]"
        style={{
          paddingLeft: `${8 + indent}px`,
          background: isSelected ? 'var(--bg-selected, var(--bg-hover))' : undefined,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
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
            style={{ color: 'var(--text-tertiary)', marginLeft: 14 /* align under chevron */ }}
          />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && expanded && node.children && node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSheetId={selectedSheetId}
              onSelectSheet={onSelectSheet}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
