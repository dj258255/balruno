/**
 * GrowthCurveChart 보조 컴포넌트 — god component 분해 (Track D-2).
 *
 * - CustomSelect: 드롭다운
 * - ToggleSwitch: 작은 토글 스위치
 * - PreviewCard: 컬러 라벨 + 값 카드
 * - NumberInput: 검증된 숫자 입력 (min/max 클램프)
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PANEL_COLOR = '#7c97c6';

interface SelectOption { value: string; label: string }

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

export function CustomSelect({ value, onChange, options, className }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full glass-input flex items-center justify-between gap-2 text-sm px-3 py-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown
          className={cn('w-4 h-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 py-1 rounded-xl shadow-lg border overflow-hidden"
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
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
                'w-full px-3 py-2 text-left text-sm transition-colors',
                option.value === value ? 'font-medium' : 'hover:bg-[var(--bg-secondary)]'
              )}
              style={{
                color: option.value === value ? PANEL_COLOR : 'var(--text-primary)',
                background: option.value === value ? `${PANEL_COLOR}15` : undefined,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToggleSwitch({ checked, color }: { checked: boolean; color: string }) {
  return (
    <div
      className="w-9 h-5 rounded-full relative transition-all"
      style={{ background: checked ? color : 'var(--border-primary)' }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </div>
  );
}

export function PreviewCard({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="glass-section flex items-center justify-between px-3 py-2" style={{ borderLeft: `3px solid ${color}` }}>
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export function NumberInput({
  value, onChange, min, max, className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={(e) => {
        const newValue = e.target.value;
        if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
          setInputValue(newValue);
          const num = parseFloat(newValue);
          if (!isNaN(num)) {
            let finalNum = num;
            if (max !== undefined) finalNum = Math.min(max, finalNum);
            if (min !== undefined) finalNum = Math.max(min, finalNum);
            onChange(finalNum);
          }
        }
      }}
      onBlur={() => {
        const num = parseFloat(inputValue);
        if (isNaN(num) || inputValue === '') {
          setInputValue(String(min ?? 0));
          onChange(min ?? 0);
        } else {
          let finalNum = num;
          if (max !== undefined) finalNum = Math.min(max, finalNum);
          if (min !== undefined) finalNum = Math.max(min, finalNum);
          setInputValue(String(finalNum));
        }
      }}
      className={className}
    />
  );
}
