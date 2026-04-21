'use client';

/**
 * 빈 상태 공통 컴포넌트 — 데이터 없을 때 일관된 안내 + CTA.
 * Grid/Kanban/Calendar/Gallery/Gantt/Form/Dashboard 전부에서 재사용.
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** 밀도: compact (패널 내부) / normal (전체 뷰) */
  size?: 'compact' | 'normal';
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'normal',
  className,
}: EmptyStateProps) {
  const pad = size === 'compact' ? 'py-6 px-4' : 'py-16 px-8';
  const iconSize = size === 'compact' ? 32 : 56;
  const titleSize = size === 'compact' ? 'text-sm' : 'text-base';

  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center', pad, className)}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div
          className="mb-3 rounded-full flex items-center justify-center"
          style={{
            width: iconSize + 24,
            height: iconSize + 24,
            background: 'var(--bg-tertiary)',
          }}
        >
          <Icon size={iconSize} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      )}
      <h3
        className={cn('font-semibold mb-1', titleSize)}
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-xs max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background:
              action.variant === 'secondary' ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: action.variant === 'secondary' ? 'var(--text-primary)' : 'white',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
