/**
 * BattleSettings - 전투 설정 패널 컴포넌트
 */

'use client';

import type { Sheet } from '@/types';
import type { BattleConfig, DefenseFormulaType, ArmorPenetrationConfig } from '@/lib/simulation/types';
import type { ColumnMapping } from '../hooks';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import Checkbox from '@/components/ui/Checkbox';

interface BattleSettingsProps {
  runs: number;
  setRuns: (value: number) => void;
  damageFormula: BattleConfig['damageFormula'];
  setDamageFormula: (value: BattleConfig['damageFormula']) => void;
  defenseFormula: DefenseFormulaType;
  setDefenseFormula: (value: DefenseFormulaType) => void;
  maxDuration: number;
  setMaxDuration: (value: number) => void;
  useArmorPen: boolean;
  setUseArmorPen: (value: boolean) => void;
  armorPen: ArmorPenetrationConfig;
  setArmorPen: (value: ArmorPenetrationConfig) => void;
  columnMapping: ColumnMapping;
  setColumnMapping: (value: ColumnMapping) => void;
  autoDetectedColumns: ColumnMapping;
  currentSheet: Sheet | undefined;
}

export function BattleSettings({
  runs,
  setRuns,
  damageFormula,
  setDamageFormula,
  defenseFormula,
  setDefenseFormula,
  maxDuration,
  setMaxDuration,
  useArmorPen,
  setUseArmorPen,
  armorPen,
  setArmorPen,
  columnMapping,
  setColumnMapping,
  autoDetectedColumns,
  currentSheet,
}: BattleSettingsProps) {
  const t = useTranslations('simulation');

  return (
    <div className="p-3 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {t('settings')}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('runs')}
          </label>
          <CustomSelect
            value={String(runs)}
            onChange={(v) => setRuns(Number(v))}
            options={[
              { value: '1000', label: t('iterations.1000') },
              { value: '5000', label: t('iterations.5000') },
              { value: '10000', label: t('iterations.10000') },
              { value: '50000', label: t('iterations.50000') },
              { value: '100000', label: t('iterations.100000') },
            ]}
            size="sm"
          />
        </div>

        <div>
          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('damageFormula')}
          </label>
          <CustomSelect
            value={damageFormula || 'simple'}
            onChange={(v) => setDamageFormula(v as BattleConfig['damageFormula'])}
            options={[
              { value: 'simple', label: t('formulas.simple') },
              { value: 'mmorpg', label: t('formulas.mmorpg') },
              { value: 'percentage', label: t('formulas.percentage') },
              { value: 'random', label: t('formulas.random') },
              { value: 'multiplicative', label: t('formulas.multiplicative') },
            ]}
            size="sm"
          />
        </div>

        <div>
          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('defenseFormula')}
          </label>
          <CustomSelect
            value={defenseFormula}
            onChange={(v) => setDefenseFormula(v as DefenseFormulaType)}
            options={[
              { value: 'subtractive', label: t('defFormulas.subtractive') },
              { value: 'divisive', label: t('defFormulas.divisive') },
              { value: 'multiplicative', label: t('defFormulas.multiplicative') },
              { value: 'logarithmic', label: t('defFormulas.logarithmic') },
            ]}
            size="sm"
          />
        </div>

        <div>
          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('maxBattleTime')}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxDuration}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d*$/.test(v)) {
                setMaxDuration(Number(v) || 0);
              }
            }}
            className="w-full input-base"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* 방어관통 설정 */}
      <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
        <label className="flex items-center gap-2 cursor-pointer mb-2 select-none">
          <Checkbox
            checked={useArmorPen}
            onChange={(e) => setUseArmorPen(e.target.checked)}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('useArmorPen')}
          </span>
        </label>

        {useArmorPen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('flatPen')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={armorPen.flatPenetration || 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*$/.test(v)) {
                    setArmorPen({ ...armorPen, flatPenetration: Number(v) || 0 });
                  }
                }}
                className="w-full input-base"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('percentPen')}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={armorPen.percentPenetration || 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    setArmorPen({ ...armorPen, percentPenetration: Number(v) || 0 });
                  }
                }}
                className="w-full input-base"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 컬럼 매핑 설정 */}
      {currentSheet && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('columnMapping')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                { key: 'name' as const, label: t('colName') },
                { key: 'hp' as const, label: 'HP' },
                { key: 'atk' as const, label: 'ATK' },
                { key: 'def' as const, label: 'DEF' },
                { key: 'speed' as const, label: 'Speed' },
                { key: 'critRate' as const, label: t('colCritRate') },
                { key: 'critDamage' as const, label: t('colCritDmg') },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </label>
                <CustomSelect
                  value={columnMapping[key]}
                  onChange={(v) => setColumnMapping({ ...columnMapping, [key]: v })}
                  options={[
                    { value: '', label: t('autoDetect') },
                    ...currentSheet.columns.map((col) => ({
                      value: col.id,
                      label: col.name + (autoDetectedColumns[key] === col.id ? ` (${t('detected')})` : ''),
                    })),
                  ]}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
