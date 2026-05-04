/**
 * 공용 커스텀 Select — 네이티브 <select> 의 운영체제별 투박함을 제거하고
 * Tailwind + CSS vars 기반 일관 스타일.
 *
 * 기능:
 *  - 아이콘 / 컬러 점 prefix (옵션마다)
 *  - 검색 (옵션 많을 때, 6개 이상)
 *  - 키보드 ↑↓/Enter/Esc
 *  - 포털/absolute 자동 선택 — 부모 overflow 무관
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** 옵션 6개 이상 자동 검색 활성 (false 로 강제 비활성 가능) */
  searchable?: boolean;
  size?: 'sm' | 'md';
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = '',
  searchable,
  size = 'md',
}: SelectProps) {
  const t = useTranslations('ui');
  const resolvedPlaceholder = placeholder ?? t('selectPlaceholder');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length >= 6;

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
    if (open) setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, showSearch, options, value]);

  const pick = useCallback((v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) pick(opt.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const btnPadding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';
  const btnMinH = size === 'sm' ? 'min-h-[28px]' : 'min-h-[36px]';

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={handleKey}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center gap-1.5 ${btnPadding} ${btnMinH} rounded-lg border bg-transparent outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent)]/50 cursor-pointer'}`}
        style={{
          borderColor: open ? 'var(--accent)' : 'var(--border-primary)',
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          background: 'var(--bg-primary)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.color && (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selected.color }} />
        )}
        {selected?.icon && <span className="flex-shrink-0">{selected.icon}</span>}
        <span className="flex-1 truncate text-left">
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg shadow-xl border overflow-hidden"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            minWidth: 180,
          }}
          role="listbox"
        >
          {showSearch && (
            <div className="p-1.5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                placeholder={t('searchPlaceholder')}
                className="w-full px-2 py-1 text-xs rounded bg-transparent border outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                {t('noResults')}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => pick(opt.value)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors"
                    style={{
                      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {opt.color && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                    )}
                    {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={12} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
