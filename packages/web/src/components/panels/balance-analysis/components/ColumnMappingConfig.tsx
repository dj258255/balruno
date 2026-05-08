/**
 * ColumnMappingConfig - 컬럼 매핑 설정 컴포넌트
 *
 * 밸런스 분석에 사용할 컬럼을 드롭다운으로 선택
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Column } from '@/types';

export interface ColumnMapping {
  name?: string;
  hp?: string;
  atk?: string;
  def?: string;
  speed?: string;
  level?: string;
  [key: string]: string | undefined;
}

interface ColumnMappingFieldProps {
  label: string;
  value: string | undefined;
  columns: Column[];
  onChange: (columnId: string | undefined) => void;
  required?: boolean;
  accentColor?: string;
}

function ColumnMappingField({
  label,
  value,
  columns,
  onChange,
  required,
  accentColor = 'var(--accent)',
}: ColumnMappingFieldProps) {
  const t = useTranslations('balanceAnalysis');
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const selectedColumn = columns.find(c => c.id === value);

  // 드롭다운 위치 계산
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  return (
    <div className="flex items-center gap-2">
      {/* 라벨 */}
      <div className="w-16 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {required && (
            <span className="text-xs" style={{ color: '#ef4444' }}>*</span>
          )}
        </div>
      </div>

      {/* 드롭다운 버튼 */}
      <div className="flex-1 relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-all"
          style={{
            background: selectedColumn ? `${accentColor}10` : 'var(--bg-tertiary)',
            border: `1px solid ${selectedColumn ? accentColor + '40' : 'var(--border-primary)'}`,
            color: selectedColumn ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          <span className="truncate text-left">
            {selectedColumn ? selectedColumn.name : t('columnSelectPlaceholder')}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-tertiary)' }}
          />
        </button>

        {/* Portal로 드롭다운 렌더링 */}
        {isOpen && typeof document !== 'undefined' && createPortal(
          <>
            {/* 백드롭 */}
            <div
              className="fixed inset-0 z-[1150]"
              onClick={() => setIsOpen(false)}
            />
            {/* 드롭다운 메뉴 */}
            <div
              className="fixed z-[1151] rounded-lg shadow-xl overflow-hidden"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                maxHeight: 240,
              }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                {/* 선택 안함 옵션 */}
                <button
                  onClick={() => {
                    onChange(undefined);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('columnSelectNone')}</span>
                </button>

                <div className="h-px" style={{ background: 'var(--border-primary)' }} />

                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => {
                      onChange(col.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      color: 'var(--text-primary)',
                      background: value === col.id ? `${accentColor}10` : undefined,
                    }}
                  >
                    <span className="w-4 flex-shrink-0">
                      {value === col.id && <Check className="w-4 h-4" style={{ color: accentColor }} />}
                    </span>
                    <span className="truncate flex-1">{col.name}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        color: 'var(--text-tertiary)',
                        background: 'var(--bg-tertiary)',
                      }}
                    >
                      {col.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
}

interface ColumnMappingConfigProps {
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  columns: Column[];
  fields: {
    key: string;
    label: string;
    required?: boolean;
    description?: string;
  }[];
  title?: string;
  accentColor?: string;
}

export function ColumnMappingConfig({
  mapping,
  onMappingChange,
  columns,
  fields,
  title,
  accentColor = 'var(--accent)',
}: ColumnMappingConfigProps) {
  const t = useTranslations('balanceAnalysis');
  const resolvedTitle = title ?? t('columnMappingTitle');
  const handleFieldChange = (fieldKey: string, columnId: string | undefined) => {
    onMappingChange({
      ...mapping,
      [fieldKey]: columnId,
    });
  };

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: accentColor }}
        />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {resolvedTitle}
        </span>
      </div>

      {/* 필드 목록 */}
      <div className="space-y-2">
        {fields.map(field => (
          <ColumnMappingField
            key={field.key}
            label={field.label}
            value={mapping[field.key]}
            columns={columns}
            onChange={(columnId) => handleFieldChange(field.key, columnId)}
            required={field.required}
            accentColor={accentColor}
          />
        ))}
      </div>
    </div>
  );
}

export default ColumnMappingConfig;
