import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface HistogramProps {
  data: number[];
  label: string;
  color: string;
  unit?: string;
  rangeLabels?: { min: number; max: number };
}

export function Histogram({ data, label, color, unit = '', rangeLabels }: HistogramProps) {
  const t = useTranslations('simulation');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        <div className="h-20 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('histNoData')}</span>
        </div>
      </div>
    );
  }

  const max = Math.max(...data);
  const total = data.reduce((a, b) => a + b, 0);

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
    setHoveredIndex(index);
  };

  // 범위 레이블 계산
  const getRangeLabel = (index: number) => {
    if (!rangeLabels) return t('histBin', { index: index + 1 });
    const step = (rangeLabels.max - rangeLabels.min) / data.length;
    const start = rangeLabels.min + step * index;
    const end = start + step;
    return `${start.toFixed(1)}${unit} ~ ${end.toFixed(1)}${unit}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between h-6">
        <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        <div
          className="text-sm px-2 py-0.5 rounded min-w-[100px] text-right transition-opacity"
          style={{
            background: hoveredIndex !== null ? `${color}20` : 'transparent',
            color,
            opacity: hoveredIndex !== null ? 1 : 0
          }}
        >
          {hoveredIndex !== null
            ? t('histCount', { count: data[hoveredIndex].toLocaleString(), pct: ((data[hoveredIndex] / total) * 100).toFixed(1) })
            : '\u00A0'
          }
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex items-end gap-px h-20 p-1 rounded-lg"
        style={{ background: 'var(--bg-primary)' }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all cursor-pointer relative group"
            style={{
              height: max > 0 ? `${(value / max) * 100}%` : '0%',
              background: color,
              opacity: hoveredIndex === i ? 1 : 0.7,
              minHeight: value > 0 ? '2px' : '0',
              transform: hoveredIndex === i ? 'scaleY(1.05)' : 'scaleY(1)',
              transformOrigin: 'bottom'
            }}
            onMouseMove={(e) => handleMouseMove(e, i)}
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}

        {/* 툴팁 */}
        {hoveredIndex !== null && (
          <div
            className="absolute z-50 px-2 py-1.5 rounded-lg text-sm pointer-events-none whitespace-nowrap"
            style={{
              left: Math.min(tooltipPosition.x, (containerRef.current?.clientWidth || 200) - 120),
              top: Math.max(tooltipPosition.y - 50, 0),
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <div className="font-medium" style={{ color }}>{getRangeLabel(hoveredIndex)}</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {t('histTimes', { count: data[hoveredIndex].toLocaleString(), pct: ((data[hoveredIndex] / total) * 100).toFixed(1) })}
            </div>
          </div>
        )}
      </div>
      {/* X축 레이블 */}
      {rangeLabels && (
        <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>{rangeLabels.min.toFixed(1)}{unit}</span>
          <span>{rangeLabels.max.toFixed(1)}{unit}</span>
        </div>
      )}
    </div>
  );
}
