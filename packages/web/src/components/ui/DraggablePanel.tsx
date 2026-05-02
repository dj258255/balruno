'use client';

import React from 'react';
import { X } from 'lucide-react';

interface DraggablePanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  style: React.CSSProperties;
  onMouseDown: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeE: (e: React.MouseEvent) => void;
  onResizeS: (e: React.MouseEvent) => void;
  onResizeSE: (e: React.MouseEvent) => void;
  headerContent?: React.ReactNode;
  className?: string;
}

export default function DraggablePanel({
  title,
  icon,
  iconColor,
  children,
  isOpen,
  onClose,
  style,
  onMouseDown,
  onDragStart,
  onResizeE,
  onResizeS,
  onResizeSE,
  headerContent,
  className = '',
}: DraggablePanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed hidden md:flex flex-col rounded-xl overflow-hidden ${className}`}
      style={{
        ...style,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        boxShadow: '4px 4px 20px rgba(0,0,0,0.15)',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 cursor-grab active:cursor-grabbing"
        style={{
          background: `${iconColor}15`,
          borderBottom: `1px solid ${iconColor}40`,
        }}
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: iconColor }}
          >
            {icon}
          </div>
          <h2 className="text-sm font-semibold" style={{ color: iconColor }}>
            {title}
          </h2>
          {headerContent}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* Resize Handles */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--accent)]"
        onMouseDown={onResizeE}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize hover:bg-[var(--accent)]"
        onMouseDown={onResizeS}
      />
      <div
        className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize rounded-tl"
        style={{ background: 'var(--border-secondary)' }}
        onMouseDown={onResizeSE}
      />
    </div>
  );
}
