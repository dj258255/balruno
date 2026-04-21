'use client';

/**
 * Kanban / Calendar / Gallery / Gantt 뷰에서 카드 우클릭 시 표시되는 공통 메뉴.
 * 편집 / 복제 / 삭제 + (옵션) 위/아래 추가.
 *
 * 사용:
 *   const [menu, setMenu] = useState<RecordContextMenuState | null>(null);
 *   <Card onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, rowId: row.id }); }} />
 *   <RecordContextMenu state={menu} onClose={() => setMenu(null)} ... />
 */

import { useEffect, useRef } from 'react';
import { Pencil, Copy, Trash2, Plus } from 'lucide-react';
import { toast } from '@/components/ui/Toast';

export interface RecordContextMenuState {
  x: number;
  y: number;
  rowId: string;
}

interface Props {
  state: RecordContextMenuState | null;
  onClose: () => void;
  onEdit: (rowId: string) => void;
  onDuplicate: (rowId: string) => void;
  onDelete: (rowId: string) => void;
  /** 옵션 — 있으면 "위/아래 추가" 표시 */
  onInsertAbove?: (rowId: string) => void;
  onInsertBelow?: (rowId: string) => void;
}

export default function RecordContextMenu({
  state, onClose,
  onEdit, onDuplicate, onDelete,
  onInsertAbove, onInsertBelow,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle as EventListener);
    document.addEventListener('keydown', handle as EventListener);
    return () => {
      document.removeEventListener('mousedown', handle as EventListener);
      document.removeEventListener('keydown', handle as EventListener);
    };
  }, [state, onClose]);

  if (!state) return null;

  // 화면 밖 잘림 방지 — 우/하단 근접 시 반대로
  const menuWidth = 180;
  const menuHeight = 220;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const x = state.x + menuWidth > vw ? state.x - menuWidth : state.x;
  const y = state.y + menuHeight > vh ? state.y - menuHeight : state.y;

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const Item = ({
    icon: Icon, label, onClick, danger, shortcut,
  }: {
    icon: typeof Pencil;
    label: string;
    onClick: () => void;
    danger?: boolean;
    shortcut?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[var(--bg-tertiary)] transition-colors"
      style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
    >
      <Icon size={12} className="flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="text-caption font-mono px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
          {shortcut}
        </kbd>
      )}
    </button>
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg shadow-xl border overflow-hidden py-1"
      style={{
        top: y,
        left: x,
        width: menuWidth,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
      role="menu"
    >
      <Item
        icon={Pencil}
        label="편집"
        onClick={run(() => onEdit(state.rowId))}
      />
      <Item
        icon={Copy}
        label="복제"
        onClick={run(() => {
          onDuplicate(state.rowId);
          toast.success('복제되었습니다');
        })}
      />
      {(onInsertAbove || onInsertBelow) && (
        <div className="h-px my-1" style={{ background: 'var(--border-primary)' }} />
      )}
      {onInsertAbove && (
        <Item
          icon={Plus}
          label="위에 추가"
          onClick={run(() => onInsertAbove(state.rowId))}
        />
      )}
      {onInsertBelow && (
        <Item
          icon={Plus}
          label="아래에 추가"
          onClick={run(() => onInsertBelow(state.rowId))}
        />
      )}
      <div className="h-px my-1" style={{ background: 'var(--border-primary)' }} />
      <Item
        icon={Trash2}
        label="삭제"
        danger
        onClick={run(() => {
          onDelete(state.rowId);
          toast.info('삭제되었습니다');
        })}
      />
    </div>
  );
}
