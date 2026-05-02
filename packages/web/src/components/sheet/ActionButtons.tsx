'use client';

/**
 * ActionButtons - 하단 액션 버튼 컴포넌트
 *
 * 행/열 추가 버튼 등 테이블 하단의 액션 버튼들
 */

import React, { memo } from 'react';
import { Plus } from 'lucide-react';

interface ActionButtonsProps {
  onAddRow: () => void;
  onAddColumn: () => void;
  addRowText: string;
  addColumnText: string;
}

const ActionButtons = memo(function ActionButtons({
  onAddRow,
  onAddColumn,
  addRowText,
  addColumnText,
}: ActionButtonsProps) {
  return (
    <div
      className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 pb-16 sm:pb-12 relative"
      style={{ borderTop: '1px solid var(--border-primary)', zIndex: 20 }}
    >
      <button
        onClick={onAddRow}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded transition-colors"
        style={{
          background: 'var(--primary-green)',
          color: 'white',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#059669')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary-green)')}
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {addRowText}
      </button>

      <button
        onClick={onAddColumn}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded transition-colors"
        style={{
          background: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {addColumnText}
      </button>
    </div>
  );
});

export default ActionButtons;
