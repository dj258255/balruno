'use client';

import { useState, useEffect } from 'react';
import { Grid3X3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/ui/Tooltip';

interface StatInputProps {
  icon: React.ElementType;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCellSelect: () => void;
  color?: string;
}

export function StatInput({
  icon: Icon,
  label,
  value,
  onChange,
  onCellSelect,
  color = 'var(--text-secondary)'
}: StatInputProps) {
  const t = useTranslations('simulation');
  const [isHovered, setIsHovered] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <label className="flex items-center gap-1 text-label mb-1" style={{ color }}>
        <Icon className="w-3 h-3" /> {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => {
            const newValue = e.target.value;
            if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
              setInputValue(newValue);
              const num = parseFloat(newValue);
              if (!isNaN(num)) onChange(num);
            }
          }}
          onBlur={() => {
            const num = parseFloat(inputValue);
            if (isNaN(num) || inputValue === '') {
              setInputValue('0');
              onChange(0);
            } else {
              setInputValue(String(num));
            }
          }}
          className="w-full input-base pr-7"
        />
        {isHovered && (
          <Tooltip content={t('cellSelect')} position="top">
            <button
              onClick={onCellSelect}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <Grid3X3 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
