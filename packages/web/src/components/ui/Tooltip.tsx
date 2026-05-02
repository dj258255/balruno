'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, position = 'top', delay = 200, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - gap;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + gap;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - gap;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + gap;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

    setCoords({ x, y });
  }, [position]);

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setCoords(null); // 위치 초기화
  }, []);

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipElement = isVisible && mounted ? (
    createPortal(
      <div
        ref={tooltipRef}
        role="tooltip"
        className="fixed z-[1100] px-2.5 py-1.5 text-xs font-medium rounded-md shadow-lg pointer-events-none animate-fadeIn"
        style={{
          left: coords?.x ?? 0,
          top: coords?.y ?? 0,
          backgroundColor: 'var(--tooltip-bg, #1f2937)',
          color: 'var(--tooltip-text, #f9fafb)',
          border: '1px solid var(--tooltip-border, #374151)',
          maxWidth: '280px',
          // 위치가 계산되기 전까지 숨김
          visibility: coords ? 'visible' : 'hidden',
          opacity: coords ? 1 : 0,
        }}
      >
        {content}
        <div
          className="absolute w-2 h-2 rotate-45"
          style={{
            backgroundColor: 'var(--tooltip-bg, #1f2937)',
            ...(position === 'top' && {
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              borderRight: '1px solid var(--tooltip-border, #374151)',
              borderBottom: '1px solid var(--tooltip-border, #374151)',
            }),
            ...(position === 'bottom' && {
              top: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              borderLeft: '1px solid var(--tooltip-border, #374151)',
              borderTop: '1px solid var(--tooltip-border, #374151)',
            }),
            ...(position === 'left' && {
              right: '-5px',
              top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              borderRight: '1px solid var(--tooltip-border, #374151)',
              borderTop: '1px solid var(--tooltip-border, #374151)',
            }),
            ...(position === 'right' && {
              left: '-5px',
              top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              borderLeft: '1px solid var(--tooltip-border, #374151)',
              borderBottom: '1px solid var(--tooltip-border, #374151)',
            }),
          }}
        />
      </div>,
      document.body
    )
  ) : null;

  // inline-flex wrapper를 사용하여 레이아웃 영향 최소화
  return (
    <span
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className={`inline-flex items-center ${className}`}
    >
      {children}
      {tooltipElement}
    </span>
  );
}
