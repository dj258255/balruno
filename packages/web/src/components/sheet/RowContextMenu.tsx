'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eraser,
  Type,
  ChevronRight,
  Check,
  Maximize2,
  Swords,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSheetUIStore } from '@/stores/sheetUIStore';

interface RowContextMenuProps {
  x: number;
  y: number;
  rowIndex: number;
  isLocked: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onClearValues: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  /** 레코드 상세 패널 열기 — 제공 시 메뉴 최상단에 표시 */
  onOpenDetail?: () => void;
  /** 시뮬 진입점 — 시트 컬럼이 unit-mappable 일 때만 제공. 라벨은 "이 행으로 시뮬" / "선택한 N행으로 팀 시뮬".
   *  disabled=true 면 hint 로만 표시 (왜 진입 안 되는지 알리는 용). */
  runSimulation?: { label: string; onClick: () => void; disabled?: boolean } | null;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  hasSubmenu?: boolean;
  submenuId?: string;
  disabled?: boolean;
}

const ROW_HEADER_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24];

export default function RowContextMenu({
  x,
  y,
  rowIndex,
  isLocked,
  onClose,
  onToggleLock,
  onDelete,
  onClearValues,
  onInsertAbove,
  onInsertBelow,
  onOpenDetail,
  runSimulation,
}: RowContextMenuProps) {
  const t = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { rowHeaderFontSize, setRowHeaderFontSize } = useSheetUIStore();

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
    ...(onOpenDetail
      ? [
          {
            label: t('contextMenu.openRecordDetail'),
            icon: <Maximize2 className="w-4 h-4" />,
            onClick: onOpenDetail,
            divider: true,
          } as MenuItem,
        ]
      : []),
    ...(runSimulation
      ? [
          {
            label: runSimulation.label,
            icon: <Swords className="w-4 h-4" />,
            onClick: runSimulation.onClick,
            divider: true,
            disabled: runSimulation.disabled,
          } as MenuItem,
        ]
      : []),
    {
      label: t('contextMenu.rowHeaderFontSize'),
      icon: <Type className="w-4 h-4" />,
      hasSubmenu: true,
      submenuId: 'rowHeaderFontSize',
      divider: true,
    },
    {
      label: isLocked ? t('table.unlockRow') : t('table.lockRow'),
      icon: isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
      onClick: onToggleLock,
      divider: true,
    },
    {
      label: t('contextMenu.insertRowAbove'),
      icon: <ArrowUp className="w-4 h-4" />,
      onClick: onInsertAbove,
    },
    {
      label: t('contextMenu.insertRowBelow'),
      icon: <ArrowDown className="w-4 h-4" />,
      onClick: onInsertBelow,
      divider: true,
    },
    {
      label: t('contextMenu.clearRowValues'),
      icon: <Eraser className="w-4 h-4" />,
      onClick: onClearValues,
    },
    {
      label: t('contextMenu.deleteRow'),
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
      {/* 행 번호 헤더 */}
      <div
        className="px-3 py-2 text-xs font-medium border-b mb-1"
        style={{
          color: 'var(--text-tertiary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {t('table.row')} {rowIndex + 1}
      </div>

      {menuItems.map((item, index) => (
        <div key={index} className="relative">
          <button
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              if (item.hasSubmenu) {
                setOpenSubmenu(openSubmenu === item.submenuId ? null : item.submenuId ?? null);
              } else if (item.onClick) {
                item.onClick();
                onClose();
              }
            }}
            onMouseEnter={(e) => {
              if (item.disabled) return;
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
            className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed"
            style={{
              color: item.disabled
                ? 'var(--text-tertiary)'
                : item.danger
                  ? 'var(--primary-red)'
                  : 'var(--text-primary)',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.6 : 1,
            }}
          >
            <span>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.hasSubmenu && <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
          </button>

          {/* Row Header Font Size Submenu */}
          {item.submenuId === 'rowHeaderFontSize' && openSubmenu === 'rowHeaderFontSize' && (
            <div
              className="absolute left-full top-0 ml-1 min-w-[120px] py-1 rounded-lg shadow-lg"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-lg)',
              }}
              onMouseEnter={() => setOpenSubmenu('rowHeaderFontSize')}
              onMouseLeave={() => setOpenSubmenu(null)}
            >
              {ROW_HEADER_FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setRowHeaderFontSize(size);
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
                    {rowHeaderFontSize === size && <Check className="w-3 h-3" />}
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
