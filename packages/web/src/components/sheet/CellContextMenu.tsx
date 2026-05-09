import { useEffect, useRef } from 'react';
import {
  Copy,
  ClipboardPaste,
  Scissors,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Type,
  Columns,
  Rows,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CellContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColumnLeft: () => void;
  onInsertColumnRight: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  canPaste: boolean;
  isMultiSelect: boolean;
  isRowNumberCell?: boolean;
  isHeaderCell?: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export default function CellContextMenu({
  x,
  y,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  canPaste,
  isMultiSelect,
  isRowNumberCell,
  isHeaderCell,
}: CellContextMenuProps) {
  const t = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);

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
      label: t('contextMenu.cut'),
      icon: <Scissors className="w-4 h-4" />,
      onClick: onCut,
      shortcut: 'Ctrl+X',
    },
    {
      label: t('contextMenu.copy'),
      icon: <Copy className="w-4 h-4" />,
      onClick: onCopy,
      shortcut: 'Ctrl+C',
    },
    {
      label: t('contextMenu.paste'),
      icon: <ClipboardPaste className="w-4 h-4" />,
      onClick: onPaste,
      shortcut: 'Ctrl+V',
      disabled: !canPaste,
    },
    {
      label: t('contextMenu.deleteContent'),
      icon: <Type className="w-4 h-4" />,
      onClick: onDelete,
      shortcut: 'Del',
      divider: true,
    },
  ];

  menuItems.push(
    {
      label: t('contextMenu.insertRowAbove'),
      icon: <ArrowUp className="w-4 h-4" />,
      onClick: onInsertRowAbove,
    },
    {
      label: t('contextMenu.insertRowBelow'),
      icon: <ArrowDown className="w-4 h-4" />,
      onClick: onInsertRowBelow,
      divider: !isHeaderCell,
    },
  );

  // 헤더 셀이 아닐 때만 열 삽입 옵션 표시
  if (!isRowNumberCell) {
    menuItems.push(
      {
        label: t('contextMenu.insertColumnLeft'),
        icon: <ArrowLeft className="w-4 h-4" />,
        onClick: onInsertColumnLeft,
      },
      {
        label: t('contextMenu.insertColumnRight'),
        icon: <ArrowRight className="w-4 h-4" />,
        onClick: onInsertColumnRight,
        divider: true,
      }
    );
  }

  menuItems.push(
    {
      label: isMultiSelect ? t('contextMenu.deleteRows') : t('contextMenu.deleteRow'),
      icon: <Rows className="w-4 h-4" />,
      onClick: onDeleteRow,
      danger: true,
    }
  );

  if (!isRowNumberCell) {
    menuItems.push({
      label: t('contextMenu.deleteColumn'),
      icon: <Columns className="w-4 h-4" />,
      onClick: onDeleteColumn,
      danger: true,
    });
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[200px] py-1 rounded-lg shadow-lg animate-scaleIn"
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
      {menuItems.map((item, index) => (
        <div key={index}>
          <button
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
            style={{
              color: item.disabled
                ? 'var(--text-tertiary)'
                : item.danger
                  ? 'var(--primary-red)'
                  : 'var(--text-primary)',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = item.danger
                  ? 'var(--primary-red-light)'
                  : 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ opacity: item.disabled ? 0.5 : 1 }}>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {item.shortcut}
              </span>
            )}
          </button>
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
