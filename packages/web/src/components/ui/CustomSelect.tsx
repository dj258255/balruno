'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  maxHeight?: number | 'none'; // 드롭다운 최대 높이 (px 또는 'none')
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
  color = '#3db88a',
  size = 'md',
  maxHeight = 240,
}: CustomSelectProps) {
  const t = useTranslations('ui');
  const resolvedPlaceholder = placeholder ?? t('selectPlaceholder');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // 드롭다운 위치 계산
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 외부 스크롤 시 드롭다운 닫기 (드롭다운 내부 스크롤은 제외)
  useEffect(() => {
    if (!isOpen) return;

    function handleScroll(e: Event) {
      // 드롭다운 내부 스크롤은 무시
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const dropdown = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] py-1 rounded-xl shadow-lg border overflow-y-auto"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        maxHeight: maxHeight === 'none' ? '80vh' : `${maxHeight}px`,
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value);
            setIsOpen(false);
          }}
          className={cn(
            'w-full px-3 py-2 text-left transition-colors flex items-center justify-between',
            sizeClasses[size],
            option.value === value
              ? 'font-medium'
              : 'hover:bg-[var(--bg-secondary)]'
          )}
          style={{
            color: option.value === value ? color : 'var(--text-primary)',
            background: option.value === value ? `${color}15` : undefined,
          }}
        >
          <div className="flex flex-col">
            <span>{option.label}</span>
            {option.description && (
              <span className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {option.description}
              </span>
            )}
          </div>
          {option.value === value && (
            <Check className="w-4 h-4 shrink-0" style={{ color }} />
          )}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={selectRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full glass-input flex items-center justify-between gap-2',
          sizeClasses[size],
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="truncate">{selectedOption?.label || resolvedPlaceholder}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>
      {dropdown}
    </div>
  );
}
