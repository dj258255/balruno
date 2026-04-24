'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Check, HelpCircle, Lock, Globe, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/hooks';
import FormulaAutocomplete from './FormulaAutocomplete';
import CustomSelect from '@/components/ui/CustomSelect';
import Checkbox from '@/components/ui/Checkbox';
import type {
  Column,
  ColumnType,
  DataType,
  ValidationConfig,
  Sheet,
  SelectOption as FieldOption,
} from '@/types';

interface ColumnModalProps {
  column?: Column;
  columns: Column[];
  sheets?: Sheet[];  // 다른 시트들 (시트 참조 자동완성용)
  currentSheetId?: string;  // 현재 시트 ID
  onSave: (data: {
    name: string;
    type: ColumnType;
    formula?: string;
    validation?: ValidationConfig;
    locked?: boolean;
    exportName?: string;
    selectOptions?: FieldOption[];
    currencyFormat?: { symbol: string; decimals: number };
    ratingMax?: number;
  }) => void;
  onClose: () => void;
  mode: 'add' | 'edit';
}

export default function ColumnModal({
  column,
  columns,
  sheets = [],
  currentSheetId,
  onSave,
  onClose,
  mode,
}: ColumnModalProps) {
  const t = useTranslations();
  const [name, setName] = useState(column?.name || '');
  const [type, setType] = useState<ColumnType>(column?.type || 'general');
  const [formula, setFormula] = useState(column?.formula || '');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showValidation, setShowValidation] = useState(!!column?.validation);
  const [dataType, setDataType] = useState<DataType>(column?.validation?.dataType || 'any');
  const [minValue, setMinValue] = useState(column?.validation?.min?.toString() || '');
  const [maxValue, setMaxValue] = useState(column?.validation?.max?.toString() || '');
  const [required, setRequired] = useState(column?.validation?.required || false);
  const [locked, setLocked] = useState(column?.locked || false);
  const [exportName, setExportName] = useState(column?.exportName || '');
  // 타입별 설정 state
  const [selectOptions, setSelectOptions] = useState<FieldOption[]>(
    column?.selectOptions ?? []
  );
  const [currencySymbol, setCurrencySymbol] = useState(
    column?.currencyFormat?.symbol ?? '₩'
  );
  const [currencyDecimals, setCurrencyDecimals] = useState(
    column?.currencyFormat?.decimals ?? 0
  );
  const [ratingMax, setRatingMax] = useState(column?.ratingMax ?? 5);
  // link 설정
  const [linkedSheetId, setLinkedSheetId] = useState(column?.linkedSheetId ?? '');
  const [linkedDisplayColumnId, setLinkedDisplayColumnId] = useState(
    column?.linkedDisplayColumnId ?? ''
  );
  const [linkedMultiple, setLinkedMultiple] = useState(column?.linkedMultiple ?? false);
  // lookup / rollup
  const [lookupLinkColumnId, setLookupLinkColumnId] = useState(
    column?.lookupLinkColumnId ?? ''
  );
  const [lookupTargetColumnId, setLookupTargetColumnId] = useState(
    column?.lookupTargetColumnId ?? ''
  );
  const [rollupAggregate, setRollupAggregate] = useState<
    'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'CONCAT'
  >(column?.rollupAggregate ?? 'SUM');
  // task-link
  const [taskSheetId, setTaskSheetId] = useState(column?.taskSheetId ?? '');
  const [taskStatusColumnId, setTaskStatusColumnId] = useState(
    column?.taskStatusColumnId ?? ''
  );
  const [taskAssigneeColumnId, setTaskAssigneeColumnId] = useState(
    column?.taskAssigneeColumnId ?? ''
  );
  // stat-snapshot
  const [snapshotSheetId, setSnapshotSheetId] = useState(column?.snapshotSheetId ?? '');
  const [snapshotColumnIds, setSnapshotColumnIds] = useState<string[]>(
    column?.snapshotColumnIds ?? []
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // ESC 키로 닫기
  useEscapeKey(onClose);

  useEffect(() => {
    if (formula.startsWith('=') && formula.length > 1) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  }, [formula]);

  const handleSave = () => {
    if (!name.trim()) return;

    const data: {
      name: string;
      type: ColumnType;
      formula?: string;
      validation?: ValidationConfig;
      locked?: boolean;
      exportName?: string;
      selectOptions?: FieldOption[];
      currencyFormat?: { symbol: string; decimals: number };
      ratingMax?: number;
      linkedSheetId?: string;
      linkedDisplayColumnId?: string;
      linkedMultiple?: boolean;
      lookupLinkColumnId?: string;
      lookupTargetColumnId?: string;
      rollupAggregate?: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'CONCAT';
      taskSheetId?: string;
      taskStatusColumnId?: string;
      taskAssigneeColumnId?: string;
      snapshotSheetId?: string;
      snapshotColumnIds?: string[];
    } = {
      name: name.trim(),
      type,
      locked,
    };

    // Export Name 설정 (빈 문자열이면 undefined로)
    if (exportName.trim()) {
      data.exportName = exportName.trim();
    }

    if (type === 'formula') {
      data.formula = formula.startsWith('=') ? formula : `=${formula}`;
    }

    // 타입별 설정 저장
    if (type === 'select' || type === 'multiSelect') {
      data.selectOptions = selectOptions.filter((o) => o.label.trim());
    }
    if (type === 'currency') {
      data.currencyFormat = { symbol: currencySymbol || '₩', decimals: currencyDecimals };
    }
    if (type === 'rating') {
      data.ratingMax = Math.max(1, Math.min(10, ratingMax));
    }
    if (type === 'link') {
      if (linkedSheetId) data.linkedSheetId = linkedSheetId;
      if (linkedDisplayColumnId) data.linkedDisplayColumnId = linkedDisplayColumnId;
      data.linkedMultiple = linkedMultiple;
    }
    if (type === 'lookup' || type === 'rollup') {
      if (lookupLinkColumnId) data.lookupLinkColumnId = lookupLinkColumnId;
      if (lookupTargetColumnId) data.lookupTargetColumnId = lookupTargetColumnId;
      if (type === 'rollup') data.rollupAggregate = rollupAggregate;
    }
    if (type === 'task-link') {
      if (taskSheetId) data.taskSheetId = taskSheetId;
      if (taskStatusColumnId) data.taskStatusColumnId = taskStatusColumnId;
      if (taskAssigneeColumnId) data.taskAssigneeColumnId = taskAssigneeColumnId;
    }
    if (type === 'stat-snapshot') {
      if (snapshotSheetId) data.snapshotSheetId = snapshotSheetId;
      if (snapshotColumnIds.length > 0) data.snapshotColumnIds = snapshotColumnIds;
    }

    if (showValidation) {
      data.validation = {
        dataType,
        required,
      };
      if (minValue !== '') {
        data.validation.min = parseFloat(minValue);
      }
      if (maxValue !== '') {
        data.validation.max = parseFloat(maxValue);
      }
    }

    onSave(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-2 sm:p-4">
      <div className="card w-full max-w-md animate-scaleIn max-h-[95vh] overflow-y-auto">
        <div className="border-b px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between" style={{
          borderColor: 'var(--border-primary)'
        }}>
          <h3 className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>
            {mode === 'add' ? t('column.addTitle') : t('column.editTitle')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('column.name')}
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('column.namePlaceholder')}
              className="w-full input-base"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Globe className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              {t('column.exportName')}
              <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                ({t('common.optional')})
              </span>
            </label>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('column.exportNamePlaceholder')}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)'
              }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              {t('column.exportNameHelp')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('column.type')}
            </label>
            <CustomSelect
              value={type}
              onChange={(v) => setType(v as ColumnType)}
              options={[
                { value: 'general', label: t('column.typeGeneral') },
                { value: 'formula', label: t('column.typeFormula') },
                { value: 'checkbox', label: 'Checkbox' },
                { value: 'select', label: 'Select' },
                { value: 'multiSelect', label: 'Multi-select' },
                { value: 'date', label: 'Date' },
                { value: 'url', label: 'URL' },
                { value: 'currency', label: 'Currency' },
                { value: 'rating', label: 'Rating' },
                { value: 'link', label: 'Link' },
                { value: 'lookup', label: 'Lookup' },
                { value: 'rollup', label: 'Rollup' },
                { value: 'task-link', label: 'Task Link' },
                { value: 'person', label: 'Person / @mention' },
                { value: 'stat-snapshot', label: 'Stat Snapshot' },
              ]}
              size="md"
            />
          </div>

          {/* link 설정 */}
          {type === 'link' && (
            <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                참조 시트 / 표시 컬럼
              </label>
              <CustomSelect
                value={linkedSheetId}
                onChange={(v) => {
                  setLinkedSheetId(v);
                  setLinkedDisplayColumnId('');
                }}
                options={[
                  { value: '', label: '— 시트 선택 —' },
                  ...sheets.filter((s) => s.id !== currentSheetId).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
                size="sm"
              />
              {linkedSheetId && (
                <CustomSelect
                  value={linkedDisplayColumnId}
                  onChange={setLinkedDisplayColumnId}
                  options={[
                    { value: '', label: '— 표시 컬럼 선택 —' },
                    ...(sheets.find((s) => s.id === linkedSheetId)?.columns.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })) ?? []),
                  ]}
                  size="sm"
                />
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={linkedMultiple}
                  onChange={(e) => setLinkedMultiple(e.target.checked)}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  다중 선택 허용 (1:N)
                </span>
              </label>
            </div>
          )}

          {/* lookup / rollup 설정 */}
          {(type === 'lookup' || type === 'rollup') && (
            <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                참조 경로 (이 시트의 link 컬럼 → 대상 시트의 컬럼)
              </label>
              <CustomSelect
                value={lookupLinkColumnId}
                onChange={(v) => {
                  setLookupLinkColumnId(v);
                  setLookupTargetColumnId('');
                }}
                options={[
                  { value: '', label: '— link 컬럼 선택 —' },
                  ...columns.filter((c) => c.type === 'link' && c.id !== column?.id).map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                size="sm"
              />
              {lookupLinkColumnId && (() => {
                const linkCol = columns.find((c) => c.id === lookupLinkColumnId);
                const targetSheet = sheets.find((s) => s.id === linkCol?.linkedSheetId);
                return (
                  <CustomSelect
                    value={lookupTargetColumnId}
                    onChange={setLookupTargetColumnId}
                    options={[
                      { value: '', label: '— 가져올 컬럼 —' },
                      ...(targetSheet?.columns.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })) ?? []),
                    ]}
                    size="sm"
                  />
                );
              })()}
              {type === 'rollup' && (
                <CustomSelect
                  value={rollupAggregate}
                  onChange={(v) => setRollupAggregate(v as typeof rollupAggregate)}
                  options={[
                    { value: 'SUM', label: 'SUM (합)' },
                    { value: 'AVG', label: 'AVG (평균)' },
                    { value: 'MIN', label: 'MIN (최소)' },
                    { value: 'MAX', label: 'MAX (최대)' },
                    { value: 'COUNT', label: 'COUNT (개수)' },
                    { value: 'CONCAT', label: 'CONCAT (이어붙이기)' },
                  ]}
                  size="sm"
                />
              )}
            </div>
          )}

          {/* stat-snapshot 설정 */}
          {type === 'stat-snapshot' && (
            <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Snapshot 대상 시트 (entity 소스)
              </label>
              <CustomSelect
                value={snapshotSheetId}
                onChange={(v) => {
                  setSnapshotSheetId(v);
                  setSnapshotColumnIds([]);
                }}
                options={[
                  { value: '', label: '— 시트 선택 —' },
                  ...sheets
                    .filter((s) => s.id !== currentSheetId)
                    .map((s) => ({ value: s.id, label: s.name })),
                ]}
                size="sm"
              />
              {snapshotSheetId && (() => {
                const targetSheet = sheets.find((s) => s.id === snapshotSheetId);
                const toggle = (id: string) => {
                  setSnapshotColumnIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  );
                };
                return (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      캡처할 stats (체크)
                    </label>
                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                      {targetSheet?.columns.map((c) => (
                        <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={snapshotColumnIds.includes(c.id)}
                            onChange={() => toggle(c.id)}
                          />
                          <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                Playtest 세션 row 에서 캡처 버튼 → 선택된 stats 가 JSON 으로 고정 저장됩니다.
              </p>
            </div>
          )}

          {/* task-link 설정 */}
          {type === 'task-link' && (
            <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Task/Sprint 시트 선택 + 상태·담당자 컬럼
              </label>
              <CustomSelect
                value={taskSheetId}
                onChange={(v) => {
                  setTaskSheetId(v);
                  setTaskStatusColumnId('');
                  setTaskAssigneeColumnId('');
                }}
                options={[
                  { value: '', label: '— task 시트 선택 —' },
                  ...sheets
                    .filter((s) => s.id !== currentSheetId)
                    .map((s) => ({ value: s.id, label: s.name })),
                ]}
                size="sm"
              />
              {taskSheetId && (() => {
                const targetSheet = sheets.find((s) => s.id === taskSheetId);
                const colOpts = [
                  { value: '', label: '— 선택 안 함 —' },
                  ...(targetSheet?.columns.map((c) => ({ value: c.id, label: c.name })) ?? []),
                ];
                return (
                  <>
                    <CustomSelect
                      value={taskStatusColumnId}
                      onChange={setTaskStatusColumnId}
                      options={colOpts}
                      size="sm"
                    />
                    <CustomSelect
                      value={taskAssigneeColumnId}
                      onChange={setTaskAssigneeColumnId}
                      options={colOpts}
                      size="sm"
                    />
                    <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                      위: 상태 컬럼 (Kanban status 표시). 아래: 담당자 컬럼 (이름/avatar 표시).
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          {/* 타입별 설정 */}
          {(type === 'select' || type === 'multiSelect') && (
            <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('column.selectOptionsLabel')}
              </label>
              {selectOptions.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={opt.color ?? '#94a3b8'}
                    onChange={(e) => {
                      const next = [...selectOptions];
                      next[i] = { ...opt, color: e.target.value };
                      setSelectOptions(next);
                    }}
                    className="w-7 h-7 rounded cursor-pointer"
                    style={{ border: '1px solid var(--border-primary)' }}
                  />
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...selectOptions];
                      next[i] = { ...opt, label: e.target.value };
                      setSelectOptions(next);
                    }}
                    placeholder={t('column.optionPlaceholder')}
                    className="flex-1 px-2 py-1.5 text-sm border rounded"
                    style={{
                      background: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectOptions(selectOptions.filter((_, j) => j !== i))
                    }
                    className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-tertiary)' }}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSelectOptions([
                    ...selectOptions,
                    { id: uuidv4(), label: '', color: '#94a3b8' },
                  ])
                }
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Plus className="w-3.5 h-3.5" /> {t('column.addOption')}
              </button>
            </div>
          )}

          {type === 'currency' && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t('column.currencySymbol')}
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  maxLength={3}
                  className="w-full px-2 py-1.5 text-sm border rounded"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t('column.currencyDecimals')}
                </label>
                <input
                  type="number"
                  value={currencyDecimals}
                  onChange={(e) => setCurrencyDecimals(Math.max(0, Math.min(6, parseInt(e.target.value) || 0)))}
                  min={0}
                  max={6}
                  className="w-full px-2 py-1.5 text-sm border rounded"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          {type === 'rating' && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('column.ratingMax')} (1-10)
              </label>
              <input
                type="number"
                value={ratingMax}
                onChange={(e) => setRatingMax(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                min={1}
                max={10}
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {type === 'formula' && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('column.formula')}
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder={t('column.formulaPlaceholder')}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderColor: 'var(--primary-purple)',
                    color: 'var(--text-primary)'
                  }}
                />
                {showAutocomplete && (
                  <FormulaAutocomplete
                    value={formula}
                    columns={columns.filter(c => c.id !== column?.id)}
                    sheets={sheets}
                    currentSheetId={currentSheetId}
                    onSelect={(newValue) => {
                      setFormula(newValue);
                      inputRef.current?.focus();
                    }}
                  />
                )}
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                {t('column.formulaHelp')}
              </p>
            </div>
          )}

          <div className="border-t pt-3" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setShowValidation(!showValidation)}
              >
                <div
                  className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: showValidation ? 'var(--primary-blue)' : 'var(--border-secondary)',
                    background: showValidation ? 'var(--primary-blue)' : 'transparent',
                  }}
                >
                  {showValidation && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('column.validation')}
                </span>
              </div>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 cursor-help" style={{ color: 'var(--text-tertiary)' }} />
                <div className="absolute right-0 bottom-full mb-2 w-56 p-2 rounded-lg shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('column.validationHelp')}</p>
                  <p>{t('column.validationHelpDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {showValidation && (
            <div className="space-y-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t('column.dataType')}
                </label>
                <CustomSelect
                  value={dataType}
                  onChange={(v) => setDataType(v as DataType)}
                  options={[
                    { value: 'any', label: t('column.dataTypeAuto') },
                    { value: 'number', label: t('column.dataTypeNumber') },
                    { value: 'integer', label: t('column.dataTypeInteger') },
                    { value: 'text', label: t('column.dataTypeText') },
                  ]}
                  size="sm"
                />
              </div>

              {(dataType === 'number' || dataType === 'integer' || dataType === 'any') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      {t('column.minValue')}
                    </label>
                    <input
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      placeholder={t('column.none')}
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      {t('column.maxValue')}
                    </label>
                    <input
                      type="number"
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                      placeholder={t('column.none')}
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setRequired(!required)}
              >
                <div
                  className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: required ? 'var(--primary-blue)' : 'var(--border-secondary)',
                    background: required ? 'var(--primary-blue)' : 'transparent',
                  }}
                >
                  {required && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t('column.required')}
                </span>
              </div>
            </div>
          )}

          <div className="border-t pt-3" style={{ borderColor: 'var(--border-primary)' }}>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setLocked(!locked)}
            >
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: locked ? 'var(--warning)' : 'var(--border-secondary)',
                  background: locked ? 'var(--warning)' : 'transparent',
                }}
              >
                {locked && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <Lock className="w-4 h-4" style={{ color: locked ? 'var(--warning)' : 'var(--text-tertiary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('column.lock')}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t px-4 sm:px-5 py-3 sm:py-4 flex justify-end gap-2" style={{
          borderColor: 'var(--border-primary)'
        }}>
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)'
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: 'white'
            }}
          >
            {mode === 'add' ? t('common.add') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
