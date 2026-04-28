'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ConfidenceBarProps {
  winRate: number;
  confidence: { lower: number; upper: number };
  color: string;
  wins?: number;
  total?: number;
}

export function ConfidenceBar({ winRate, confidence, color, wins, total }: ConfidenceBarProps) {
  const t = useTranslations('simulation');
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-8 rounded-lg overflow-hidden cursor-pointer" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
        {/* 신뢰구간 범위 */}
        <div
          className="absolute h-full transition-opacity"
          style={{
            left: `${confidence.lower * 100}%`,
            width: `${(confidence.upper - confidence.lower) * 100}%`,
            background: `${color}30`,
            opacity: isHovered ? 1 : 0.5
          }}
        />
        {/* 실제 승률 바 */}
        <div
          className="absolute h-full transition-all"
          style={{
            width: `${winRate * 100}%`,
            background: `linear-gradient(90deg, ${color}, ${color})`,
            boxShadow: isHovered ? `0 0 10px ${color}50` : 'none'
          }}
        />
        {/* 승률 텍스트 */}
        <div
          className="absolute inset-0 flex items-center justify-center text-sm font-bold transition-transform"
          style={{
            color: 'var(--text-primary)',
            textShadow: '0 0 4px var(--bg-primary), 0 0 4px var(--bg-primary), 0 0 8px var(--bg-primary)',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {(winRate * 100).toFixed(1)}%
        </div>
      </div>

      {/* 호버 시 상세 정보 */}
      {isHovered && wins !== undefined && total !== undefined && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 rounded-lg text-sm z-50 whitespace-nowrap"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div className="font-medium mb-1" style={{ color }}>{t('winsOver', { wins: wins.toLocaleString(), total: total.toLocaleString() })}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {t('ci95', { lower: (confidence.lower * 100).toFixed(1), upper: (confidence.upper * 100).toFixed(1) })}
          </div>
        </div>
      )}
    </div>
  );
}
