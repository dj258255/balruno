'use client';

import { ReactNode, useState, useEffect } from 'react';
import { X, LucideIcon, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  // 헤더 props
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  onClose?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  headerExtra?: ReactNode;
  // 옵션
  noPadding?: boolean;
  compact?: boolean;
}

// 드래그 힌트가 표시되었는지 확인
const DRAG_HINT_KEY = 'balruno-drag-hint-shown-v2';

export function GlassPanel({
  children,
  className,
  title,
  icon: Icon,
  iconColor = 'var(--accent)',
  onClose,
  onDragStart,
  headerExtra,
  noPadding = false,
  compact = false,
}: GlassPanelProps) {
  const [showDragHint, setShowDragHint] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && onDragStart) {
      const hintShown = localStorage.getItem(DRAG_HINT_KEY);
      if (!hintShown) {
        setShowDragHint(true);
        const timer = setTimeout(() => {
          setShowDragHint(false);
          localStorage.setItem(DRAG_HINT_KEY, 'true');
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [onDragStart]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
      return;
    }
    if (showDragHint) {
      setShowDragHint(false);
      localStorage.setItem(DRAG_HINT_KEY, 'true');
    }
    if (onDragStart) {
      onDragStart(e);
    }
  };

  const hasHeader = title || Icon || onClose || headerExtra;

  return (
    <div
      className={cn(
        "glass-panel flex flex-col overflow-hidden animate-scaleIn",
        className
      )}
    >
      {/* Header */}
      {hasHeader && (
        <div
          className={cn(
            "glass-panel-header relative shrink-0",
            onDragStart && "cursor-grab active:cursor-grabbing"
          )}
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            {onDragStart && (
              <div
                className="p-1 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: iconColor }}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            {/* Icon */}
            {Icon && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${iconColor}, ${iconColor}dd)`,
                  boxShadow: `0 4px 12px ${iconColor}30`,
                }}
              >
                <Icon className="w-4.5 h-4.5 text-white" />
              </div>
            )}

            {/* Title */}
            {title && (
              <h3
                className="font-semibold text-[15px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h3>
            )}

            {/* Extra Content */}
            {headerExtra}
          </div>

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:scale-105 active:scale-95"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Drag Hint */}
          {showDragHint && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn z-50 glass-card"
            >
              <GripVertical className="w-4 h-4" style={{ color: iconColor }} />
              <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                헤더를 드래그하여 이동
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex-1 overflow-auto",
          !noPadding && (compact ? "p-4" : "p-5")
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Glass Section 컴포넌트
interface GlassSectionProps {
  children: ReactNode;
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function GlassSection({
  children,
  title,
  icon: Icon,
  iconColor,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: GlassSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cn("glass-section", className)}>
      {title && (
        <div
          className={cn(
            "flex items-center gap-2 mb-3",
            collapsible && "cursor-pointer"
          )}
          onClick={() => collapsible && setCollapsed(!collapsed)}
        >
          {Icon && (
            <Icon
              className="w-4 h-4"
              style={{ color: iconColor || 'var(--text-secondary)' }}
            />
          )}
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          {collapsible && (
            <span
              className="ml-auto text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {collapsed ? '펼치기' : '접기'}
            </span>
          )}
        </div>
      )}
      {!collapsed && children}
    </div>
  );
}

// Glass Stat 컴포넌트
interface GlassStatProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function GlassStat({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendValue,
  className,
}: GlassStatProps) {
  const trendColors = {
    up: '#10b981',
    down: '#ef4444',
    neutral: 'var(--text-tertiary)',
  };

  return (
    <div className={cn("glass-stat", className)}>
      {Icon && (
        <div className="flex justify-center mb-2">
          <Icon
            className="w-5 h-5"
            style={{ color: iconColor || 'var(--text-secondary)' }}
          />
        </div>
      )}
      <div
        className="text-2xl font-bold mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      {trend && trendValue && (
        <div
          className="text-xs font-semibold mt-1"
          style={{ color: trendColors[trend] }}
        >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
        </div>
      )}
    </div>
  );
}

// Glass Tabs 컴포넌트
interface GlassTabsProps<T extends string> {
  tabs: { id: T; label: string; icon?: LucideIcon }[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export function GlassTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: GlassTabsProps<T>) {
  return (
    <div className={cn("glass-tabs", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn("glass-tab flex items-center gap-2", activeTab === tab.id && "active")}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <tab.icon className="w-4 h-4" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
