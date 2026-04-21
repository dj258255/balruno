/**
 * SidebarContextMenus - 컨텍스트 메뉴 컴포넌트들
 */

'use client';

import { useState } from 'react';
import { Edit2, Trash2, Copy, Plus, Code, FolderPlus, Folder, Tag, Check, ChevronRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { useTranslations } from 'next-intl';
import type { SheetKind } from '@/types';
import { KIND_META } from '@/lib/sheetKind';
import type {
  SheetContextMenuState,
  ProjectContextMenuState,
  FolderContextMenuState,
  SheetMoveConfirmState,
  SheetDeleteConfirmState,
  ProjectDeleteConfirmState,
  FolderDeleteConfirmState,
} from '../hooks/useSidebarState';

// === Sheet Context Menu ===
interface SheetContextMenuProps {
  menu: SheetContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  currentKind?: SheetKind;
  onRename: (sheetId: string, sheetName: string) => void;
  onEditClassName: (sheetId: string, className?: string) => void;
  onSetKind?: (projectId: string, sheetId: string, kind: SheetKind | undefined) => void;
  onDuplicate: (projectId: string, sheetId: string) => void;
  onDelete: (projectId: string, sheetId: string, sheetName: string) => void;
  onClose: () => void;
}

export function SheetContextMenu({
  menu,
  menuRef,
  currentKind,
  onRename,
  onEditClassName,
  onSetKind,
  onDuplicate,
  onDelete,
  onClose,
}: SheetContextMenuProps) {
  const t = useTranslations();
  const [kindSubmenuOpen, setKindSubmenuOpen] = useState(false);

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] py-1 rounded-lg shadow-lg border"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <button
        onClick={() => {
          onRename(menu.sheetId, menu.sheetName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('sheet.rename')}
      </button>
      <button
        onClick={() => {
          onEditClassName(menu.sheetId, menu.exportClassName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Code className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('sheet.editClassName')}
      </button>
      {onSetKind && (
        <div
          className="relative"
          onMouseEnter={() => setKindSubmenuOpen(true)}
          onMouseLeave={() => setKindSubmenuOpen(false)}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Tag className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <span className="flex-1">시트 용도</span>
            <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
          </button>
          {kindSubmenuOpen && (
            <div
              className="absolute left-full top-0 ml-1 min-w-[180px] py-1 rounded-lg shadow-lg border"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
            >
              <button
                onClick={() => { onSetKind(menu.projectId, menu.sheetId, undefined); onClose(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--text-tertiary)' }} />
                <span className="flex-1">자동 감지</span>
                {!currentKind && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />}
              </button>
              <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
              {(Object.keys(KIND_META) as SheetKind[]).map((kind) => {
                const meta = KIND_META[kind];
                return (
                  <button
                    key={kind}
                    onClick={() => { onSetKind(menu.projectId, menu.sheetId, kind); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title={meta.description}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                    <span className="flex-1">{meta.label}</span>
                    {currentKind === kind && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => {
          onDuplicate(menu.projectId, menu.sheetId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('sheet.duplicate')}
      </button>
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
      <button
        onClick={() => {
          onDelete(menu.projectId, menu.sheetId, menu.sheetName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--danger)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Trash2 className="w-4 h-4" />
        {t('common.delete')}
      </button>
    </div>
  );
}

// === Project Context Menu ===
interface ProjectContextMenuProps {
  menu: ProjectContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onNewSheet: (projectId: string) => void;
  onNewFolder: (projectId: string) => void;
  onRename: (projectId: string, projectName: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string, projectName: string) => void;
  onClose: () => void;
}

export function ProjectContextMenu({
  menu,
  menuRef,
  onNewSheet,
  onNewFolder,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: ProjectContextMenuProps) {
  const t = useTranslations();

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] py-1 rounded-lg shadow-lg border"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <button
        onClick={() => {
          onNewSheet(menu.projectId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Plus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('sheet.newSheet')}
      </button>
      <button
        onClick={() => {
          onNewFolder(menu.projectId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <FolderPlus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('folder.newFolder')}
      </button>
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
      <button
        onClick={() => {
          onRename(menu.projectId, menu.projectName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('project.rename')}
      </button>
      <button
        onClick={() => {
          onDuplicate(menu.projectId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('project.duplicate')}
      </button>
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
      <button
        onClick={() => {
          onDelete(menu.projectId, menu.projectName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--danger)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Trash2 className="w-4 h-4" />
        {t('common.delete')}
      </button>
    </div>
  );
}

// === Folder Context Menu ===
interface FolderContextMenuProps {
  menu: FolderContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onNewSheet: (projectId: string, folderId: string) => void;
  onNewSubfolder: (projectId: string, parentId: string) => void;
  onRename: (folderId: string, folderName: string) => void;
  onDelete: (projectId: string, folderId: string, folderName: string) => void;
  onClose: () => void;
}

export function FolderContextMenu({
  menu,
  menuRef,
  onNewSheet,
  onNewSubfolder,
  onRename,
  onDelete,
  onClose,
}: FolderContextMenuProps) {
  const t = useTranslations();

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] py-1 rounded-lg shadow-lg border"
      style={{
        left: menu.x,
        top: menu.y,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <button
        onClick={() => {
          onNewSheet(menu.projectId, menu.folderId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Plus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('sheet.newSheet')}
      </button>
      <button
        onClick={() => {
          onNewSubfolder(menu.projectId, menu.folderId);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <FolderPlus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('folder.newSubfolder')}
      </button>
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
      <button
        onClick={() => {
          onRename(menu.folderId, menu.folderName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        {t('folder.rename')}
      </button>
      <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
      <button
        onClick={() => {
          onDelete(menu.projectId, menu.folderId, menu.folderName);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
        style={{ color: 'var(--danger)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Trash2 className="w-4 h-4" />
        {t('common.delete')}
      </button>
    </div>
  );
}

// === Class Name Edit Modal ===
interface ClassNameEditModalProps {
  sheetId: string | null;
  className: string;
  setClassName: (value: string) => void;
  onSave: (sheetId: string, className: string) => void;
  onClose: () => void;
}

export function ClassNameEditModal({
  sheetId,
  className,
  setClassName,
  onSave,
  onClose,
}: ClassNameEditModalProps) {
  const t = useTranslations();

  if (!sheetId) return null;

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100]">
      <div
        className="w-80 p-4 rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('sheet.editClassName')}
        </h3>
        <input
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && className.trim()) {
              onSave(sheetId, className.trim());
            }
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="CharacterStats"
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none mb-2"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)'
          }}
          autoFocus
        />
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {t('gameEngineExport.classNameHint')}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onSave(sheetId, className.trim())}
            className="px-3 py-1.5 text-sm rounded-lg"
            style={{ background: 'var(--primary-blue)', color: 'white' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Confirm Dialogs ===
interface ConfirmDialogsProps {
  sheetMoveConfirm: SheetMoveConfirmState | null;
  setSheetMoveConfirm: (value: null) => void;
  onMoveSheet: (from: string, to: string, sheetId: string) => void;
  sheetDeleteConfirm: SheetDeleteConfirmState | null;
  setSheetDeleteConfirm: (value: null) => void;
  onDeleteSheet: (projectId: string, sheetId: string) => void;
  projectDeleteConfirm: ProjectDeleteConfirmState | null;
  setProjectDeleteConfirm: (value: null) => void;
  onDeleteProject: (projectId: string) => void;
  folderDeleteConfirm?: FolderDeleteConfirmState | null;
  setFolderDeleteConfirm?: (value: null) => void;
  onDeleteFolder?: (projectId: string, folderId: string) => void;
}

export function ConfirmDialogs({
  sheetMoveConfirm,
  setSheetMoveConfirm,
  onMoveSheet,
  sheetDeleteConfirm,
  setSheetDeleteConfirm,
  onDeleteSheet,
  projectDeleteConfirm,
  setProjectDeleteConfirm,
  onDeleteProject,
  folderDeleteConfirm,
  setFolderDeleteConfirm,
  onDeleteFolder,
}: ConfirmDialogsProps) {
  const t = useTranslations();

  return (
    <>
      <ConfirmDialog
        isOpen={!!sheetMoveConfirm}
        onClose={() => setSheetMoveConfirm(null)}
        onConfirm={() => {
          if (sheetMoveConfirm) {
            onMoveSheet(sheetMoveConfirm.fromProjectId, sheetMoveConfirm.toProjectId, sheetMoveConfirm.sheetId);
          }
        }}
        title={t('sheet.moveSheet')}
        message={t('sheet.moveConfirm', { sheetName: sheetMoveConfirm?.sheetName || '', projectName: sheetMoveConfirm?.toProjectName || '' })}
        confirmText={t('common.move')}
        cancelText={t('common.cancel')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!sheetDeleteConfirm}
        onClose={() => setSheetDeleteConfirm(null)}
        onConfirm={() => {
          if (sheetDeleteConfirm) {
            onDeleteSheet(sheetDeleteConfirm.projectId, sheetDeleteConfirm.sheetId);
          }
        }}
        title={t('sheet.deleteSheet')}
        message={t('alert.deleteSheetConfirm', { name: sheetDeleteConfirm?.sheetName || '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!projectDeleteConfirm}
        onClose={() => setProjectDeleteConfirm(null)}
        onConfirm={() => {
          if (projectDeleteConfirm) {
            onDeleteProject(projectDeleteConfirm.projectId);
          }
        }}
        title={t('project.deleteProject')}
        message={t('project.deleteConfirm', { name: projectDeleteConfirm?.projectName || '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      {folderDeleteConfirm && setFolderDeleteConfirm && onDeleteFolder && (
        <ConfirmDialog
          isOpen={!!folderDeleteConfirm}
          onClose={() => setFolderDeleteConfirm(null)}
          onConfirm={() => {
            onDeleteFolder(folderDeleteConfirm.projectId, folderDeleteConfirm.folderId);
          }}
          title={t('folder.deleteFolder')}
          message={t('folder.deleteConfirm', { name: folderDeleteConfirm.folderName })}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />
      )}
    </>
  );
}
