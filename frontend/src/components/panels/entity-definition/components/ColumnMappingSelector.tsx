'use client';

import CustomSelect from '@/components/ui/CustomSelect';

export interface ExportFieldNames {
  entityId: string;
  entityName: string;
  level: string;
}

interface ColumnMappingSelectorProps {
  availableColumns: string[];
  idColumn: string;
  nameColumn: string;
  levelColumn: string;
  onIdColumnChange: (column: string) => void;
  onNameColumnChange: (column: string) => void;
  onLevelColumnChange: (column: string) => void;
  exportFieldNames: ExportFieldNames;
  onExportFieldNamesChange: (fieldNames: ExportFieldNames) => void;
}

export default function ColumnMappingSelector({
  availableColumns,
  idColumn,
  nameColumn,
  levelColumn,
  onIdColumnChange,
  onNameColumnChange,
  onLevelColumnChange,
  exportFieldNames,
  onExportFieldNamesChange,
}: ColumnMappingSelectorProps) {
  const columnOptions = [
    { value: '', label: '선택...' },
    ...availableColumns.map((col) => ({ value: col, label: col })),
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        컬럼 매핑
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* ID 컬럼 */}
        <div
          className="p-3 rounded-lg space-y-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <label className="text-xs block font-medium" style={{ color: 'var(--text-secondary)' }}>
            ID 컬럼
          </label>
          <CustomSelect
            value={idColumn}
            onChange={onIdColumnChange}
            options={columnOptions}
            placeholder="선택..."
            size="sm"
            color="#f59e0b"
          />
          <label className="text-xs block" style={{ color: 'var(--text-tertiary)' }}>
            Export명
          </label>
          <input
            type="text"
            value={exportFieldNames.entityId}
            onChange={(e) => onExportFieldNamesChange({ ...exportFieldNames, entityId: e.target.value })}
            placeholder={idColumn || 'ID'}
            className="w-full input-compact"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* 이름 컬럼 */}
        <div
          className="p-3 rounded-lg space-y-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <label className="text-xs block font-medium" style={{ color: 'var(--text-secondary)' }}>
            이름 컬럼
          </label>
          <CustomSelect
            value={nameColumn}
            onChange={onNameColumnChange}
            options={columnOptions}
            placeholder="선택..."
            size="sm"
            color="#f59e0b"
          />
          <label className="text-xs block" style={{ color: 'var(--text-tertiary)' }}>
            Export명
          </label>
          <input
            type="text"
            value={exportFieldNames.entityName}
            onChange={(e) => onExportFieldNamesChange({ ...exportFieldNames, entityName: e.target.value })}
            placeholder={nameColumn || '이름'}
            className="w-full input-compact"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* 레벨 컬럼 */}
        <div
          className="p-3 rounded-lg space-y-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <label className="text-xs block font-medium" style={{ color: 'var(--text-secondary)' }}>
            레벨 컬럼 <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(선택)</span>
          </label>
          <CustomSelect
            value={levelColumn}
            onChange={onLevelColumnChange}
            options={columnOptions}
            placeholder="자동 생성"
            size="sm"
            color="#f59e0b"
          />
          <label className="text-xs block" style={{ color: 'var(--text-tertiary)' }}>
            Export명
          </label>
          <input
            type="text"
            value={exportFieldNames.level}
            onChange={(e) => onExportFieldNamesChange({ ...exportFieldNames, level: e.target.value })}
            placeholder={levelColumn || '레벨'}
            className="w-full input-compact"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        시트에서 엔티티를 식별할 컬럼을 지정합니다. Export명이 비어있으면 선택한 컬럼명이 사용됩니다.
      </p>
    </div>
  );
}
