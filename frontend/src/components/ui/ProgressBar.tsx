'use client';

/**
 * 진행률 표시 컴포넌트. 0~1 사이 value 또는 indeterminate.
 * AutoBalancer, LootSimulator, 추후 Monte Carlo 시뮬 등에 공통 사용.
 */

interface ProgressBarProps {
  /** 0~1 진행률. undefined 면 indeterminate (애니메이션만) */
  value?: number;
  /** 상단 표시 라벨 */
  label?: string;
  /** 우측 상세 텍스트 (예: "234 / 500") */
  detail?: string;
  /** 색상 override (기본 accent) */
  color?: string;
  /** 컴팩트 모드 (작은 높이) */
  compact?: boolean;
}

export default function ProgressBar({
  value,
  label,
  detail,
  color = 'var(--accent)',
  compact = false,
}: ProgressBarProps) {
  const pct = value !== undefined ? Math.max(0, Math.min(1, value)) * 100 : undefined;
  const indeterminate = value === undefined;

  return (
    <div className="space-y-1">
      {(label || detail) && (
        <div className="flex items-center justify-between text-caption">
          {label && <span style={{ color: 'var(--text-primary)' }}>{label}</span>}
          {detail && <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{detail}</span>}
        </div>
      )}
      <div
        className="relative rounded-full overflow-hidden"
        style={{
          height: compact ? 4 : 6,
          background: 'var(--bg-tertiary)',
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
      >
        {indeterminate ? (
          <div
            className="absolute inset-y-0 rounded-full animate-pulse"
            style={{
              width: '40%',
              background: color,
              animation: 'progress-slide 1.2s ease-in-out infinite',
            }}
          />
        ) : (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              background: color,
            }}
          />
        )}
      </div>
      <style jsx>{`
        @keyframes progress-slide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
