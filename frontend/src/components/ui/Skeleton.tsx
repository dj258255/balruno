'use client';

/**
 * 로딩 스켈레톤 — 데이터 패치 대기 동안 레이아웃만 미리 보이기.
 * Airtable / Linear 수준의 플릭커 방지.
 */

import { cn } from '@/lib/utils';

export interface SkeletonProps {
  /** 너비 (픽셀 또는 CSS string). 기본 100% */
  width?: number | string;
  /** 높이. 기본 16 */
  height?: number | string;
  /** 테두리 둥글기 */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** 스켈레톤 여러 개 세로로 반복 */
  lines?: number;
  /** 마지막 줄 너비 (기본 70%) */
  lastLineWidth?: string;
  className?: string;
}

const roundedMap: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: '',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export default function Skeleton({
  width = '100%',
  height = 16,
  rounded = 'md',
  lines = 1,
  lastLineWidth = '70%',
  className,
}: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn('skeleton-pulse', roundedMap[rounded])}
            style={{
              width: i === lines - 1 ? lastLineWidth : width,
              height,
              background: 'var(--bg-tertiary)',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('skeleton-pulse', roundedMap[rounded], className)}
      style={{
        width,
        height,
        background: 'var(--bg-tertiary)',
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: 'var(--bg-secondary)' }}>
      <Skeleton height={12} width="60%" />
      <Skeleton height={20} width="90%" />
      <Skeleton height={10} width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={24} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
