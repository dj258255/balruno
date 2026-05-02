'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  EyeOff,
  Eye,
  Eraser,
  Type,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSheetUIStore } from '@/stores/sheetUIStore';

interface ColumnContextMenuProps {
  x: number;
  y: number;
  columnName: string;
  isLocked: boolean;
  isExportExcluded: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onToggleExportExclude: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearValues: () => void;
  onInsertLeft: () => void;
  onInsertRight: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  hasSubmenu?: boolean;
  submenuId?: string;
}

const HEADER_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24];

export default function ColumnContextMenu({
  x,
  y,
  columnName,
  isLocked,
  isExportExcluded,
  onClose,
  onToggleLock,
  onToggleExportExclude,
  onEdit,
  onDelete,
  onClearValues,
  onInsertLeft,
  onInsertRight,
}: ColumnContextMenuProps) {
  const t = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { columnHeaderFontSize, setColumnHeaderFontSize } = useSheetUIStore();

  // 메뉴 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems: MenuItem[] = [
    {
      label: t('contextMenu.headerFontSize'),
      icon: <Type className="w-4 h-4" />,
      hasSubmenu: true,
      submenuId: 'headerFontSize',
      divider: true,
    },
    {
      label: isLocked ? t('table.unlockColumn') : t('table.lockColumn'),
      icon: isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
      onClick: onToggleLock,
    },
    {
      label: isExportExcluded ? t('table.includeInExport') : t('table.excludeFromExport'),
      icon: isExportExcluded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
      onClick: onToggleExportExclude,
    },
    {
      label: t('table.editColumn'),
      icon: <Edit3 className="w-4 h-4" />,
      onClick: onEdit,
      divider: true,
    },
    {
      label: t('contextMenu.insertColumnLeft'),
      icon: <ArrowLeft className="w-4 h-4" />,
      onClick: onInsertLeft,
    },
    {
      label: t('contextMenu.insertColumnRight'),
      icon: <ArrowRight className="w-4 h-4" />,
      onClick: onInsertRight,
      divider: true,
    },
    {
      label: t('contextMenu.clearColumnValues'),
      icon: <Eraser className="w-4 h-4" />,
      onClick: onClearValues,
    },
    {
      label: t('table.deleteColumn'),
      icon: <Trash2 className="w-4 h-4" />,
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[180px] py-1 rounded-lg shadow-lg animate-scaleIn"
      style={{
        left: x,
        top: y,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {/* 컬럼 이름 헤더 */}
      <div
        className="px-3 py-2 text-xs font-medium border-b mb-1"
        style={{
          color: 'var(--text-tertiary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {columnName}
      </div>

      {menuItems.map((item, index) => (
        <div key={index} className="relative">
          <button
            onClick={() => {
              if (item.hasSubmenu) {
                setOpenSubmenu(openSubmenu === item.submenuId ? null : item.submenuId ?? null);
              } else if (item.onClick) {
                item.onClick();
                onClose();
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = item.danger
                ? 'var(--primary-red-light)'
                : 'var(--bg-hover)';
              if (item.hasSubmenu) {
                setOpenSubmenu(item.submenuId ?? null);
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
            style={{
              color: item.danger ? 'var(--primary-red)' : 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <span>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.hasSubmenu && <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
          </button>

          {/* Header Font Size Submenu */}
          {item.submenuId === 'headerFontSize' && openSubmenu === 'headerFontSize' && (
            <div
              className="absolute left-full top-0 ml-1 min-w-[120px] py-1 rounded-lg shadow-lg"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-lg)',
              }}
              onMouseEnter={() => setOpenSubmenu('headerFontSize')}
              onMouseLeave={() => setOpenSubmenu(null)}
            >
              {HEADER_FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setColumnHeaderFontSize(size);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="w-4 flex justify-center">
                    {columnHeaderFontSize === size && <Check className="w-3 h-3" />}
                  </span>
                  <span>{size}px</span>
                </button>
              ))}
            </div>
          )}

          {item.divider && (
            <div
              className="my-1 mx-2"
              style={{
                height: 1,
                background: 'var(--border-primary)'
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
