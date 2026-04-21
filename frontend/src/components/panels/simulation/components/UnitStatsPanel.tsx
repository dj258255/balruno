/**
 * UnitStatsPanel - 1v1 유닛 스탯 입력 패널
 */

'use client';

import { useState, useEffect } from 'react';
import { Heart, Swords, Shield, Zap, ChevronDown, ChevronUp, Target, Sparkles, Wind, Crosshair, Brain, Gauge } from 'lucide-react';
import type { UnitStats, Skill } from '@/lib/simulation/types';
import { StatInput } from './StatInput';
import { UnitPicker } from './UnitPicker';
import { SkillEditor } from './SkillEditor';
import { useTranslations } from 'next-intl';

/**
 * 실력 slider (0-100) — composite skill 입력.
 * 50 이 중앙 (기본값). 0 약함 (보정 0.6x), 100 강함 (보정 1.4x).
 */
function SkillSlider({
  icon: Icon,
  label,
  description,
  value,
  onChange,
  color,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const tier =
    value < 30 ? '초보' : value < 50 ? '평균 이하' : value < 70 ? '평균' : value < 85 ? '숙련' : '전문가';
  return (
    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          {description}
        </span>
        <span className="ml-auto text-label font-semibold tabular-nums" style={{ color }}>
          {value} · {tier}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

interface UnitStatsPanelProps {
  unitStats: UnitStats;
  setUnitStats: (fn: (prev: UnitStats) => UnitStats) => void;
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  showSkills: boolean;
  setShowSkills: (show: boolean) => void;
  units: UnitStats[];
  onLoadFromSheet: (unit: UnitStats) => void;
  startCellSelection: (label: string, callback: (value: string | number | boolean | null) => void) => void;
  color: string;
  placeholder: string;
}

// 선택적 스탯 입력 (빈 값 허용)
function OptionalStatInput({
  label,
  value,
  onChange,
  multiplier = 1,
  placeholder,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  multiplier?: number;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color?: string;
}) {
  const [inputValue, setInputValue] = useState(
    value !== undefined ? String(value * multiplier) : ''
  );

  useEffect(() => {
    setInputValue(value !== undefined ? String(value * multiplier) : '');
  }, [value, multiplier]);

  return (
    <div>
      <label className="flex items-center gap-1 text-label mb-1" style={{ color: color || 'var(--text-secondary)' }}>
        {Icon && <Icon className="w-3 h-3" style={{ color }} />}
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
            setInputValue(v);
            if (v === '') {
              onChange(undefined);
            } else {
              const num = parseFloat(v);
              if (!isNaN(num)) {
                onChange(num / multiplier);
              }
            }
          }
        }}
        placeholder={placeholder}
        className="w-full input-base"
      />
    </div>
  );
}

export function UnitStatsPanel({
  unitStats,
  setUnitStats,
  skills,
  setSkills,
  showSkills,
  setShowSkills,
  units,
  onLoadFromSheet,
  startCellSelection,
  color,
  placeholder,
}: UnitStatsPanelProps) {
  const t = useTranslations('simulation');
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${color}` }}>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={unitStats.name}
          onChange={(e) => setUnitStats(prev => ({ ...prev, name: e.target.value }))}
          className="input-base font-medium flex-1 min-w-0"
          style={{ color }}
          placeholder={placeholder}
        />
        <UnitPicker
          units={units}
          onSelect={onLoadFromSheet}
          color={color}
          buttonText={t('loadFromSheet')}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
        <StatInput
          icon={Heart}
          label="HP"
          value={unitStats.maxHp}
          onChange={(v) => setUnitStats(prev => ({ ...prev, maxHp: v, hp: v }))}
          onCellSelect={() => startCellSelection(`HP (${unitStats.name})`, (value) => {
            const num = Number(value);
            if (!isNaN(num)) setUnitStats(prev => ({ ...prev, maxHp: num, hp: num }));
          })}
          color="#e86161"
        />
        <StatInput
          icon={Swords}
          label="ATK"
          value={unitStats.atk}
          onChange={(v) => setUnitStats(prev => ({ ...prev, atk: v }))}
          onCellSelect={() => startCellSelection(`ATK (${unitStats.name})`, (value) => {
            const num = Number(value);
            if (!isNaN(num)) setUnitStats(prev => ({ ...prev, atk: num }));
          })}
          color="#e5a440"
        />
        <StatInput
          icon={Shield}
          label="DEF"
          value={unitStats.def}
          onChange={(v) => setUnitStats(prev => ({ ...prev, def: v }))}
          onCellSelect={() => startCellSelection(`DEF (${unitStats.name})`, (value) => {
            const num = Number(value);
            if (!isNaN(num)) setUnitStats(prev => ({ ...prev, def: num }));
          })}
          color="#5a9cf5"
        />
        <StatInput
          icon={Zap}
          label="SPD"
          value={unitStats.speed}
          onChange={(v) => setUnitStats(prev => ({ ...prev, speed: v }))}
          onCellSelect={() => startCellSelection(`SPD (${unitStats.name})`, (value) => {
            const num = Number(value);
            if (!isNaN(num)) setUnitStats(prev => ({ ...prev, speed: num }));
          })}
          color="#9179f2"
        />
      </div>

      {/* 고급 옵션 (크리티컬, 명중, 회피) */}
      <details className="mt-3 pt-3 group" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <summary className="text-sm cursor-pointer list-none flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
          <span>고급 옵션 (크리티컬, 명중, 회피)</span>
          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <OptionalStatInput
            label={`${t('colCritRate')} %`}
            value={unitStats.critRate}
            onChange={(v) => setUnitStats(prev => ({ ...prev, critRate: v }))}
            multiplier={100}
            placeholder="0"
            icon={Target}
            color="#e5a440"
          />
          <OptionalStatInput
            label={`${t('colCritDmg')} x`}
            value={unitStats.critDamage}
            onChange={(v) => setUnitStats(prev => ({ ...prev, critDamage: v }))}
            placeholder="1.5"
            icon={Sparkles}
            color="#f59e0b"
          />
          <OptionalStatInput
            label="명중 %"
            value={unitStats.accuracy}
            onChange={(v) => setUnitStats(prev => ({ ...prev, accuracy: v }))}
            multiplier={100}
            placeholder="100"
            icon={Target}
            color="#3db88a"
          />
          <OptionalStatInput
            label="회피 %"
            value={unitStats.evasion}
            onChange={(v) => setUnitStats(prev => ({ ...prev, evasion: v }))}
            multiplier={100}
            placeholder="0"
            icon={Wind}
            color="#9179f2"
          />
        </div>
      </details>

      {/* 조종자 실력 (Composite Skill) — Overwatch/Destiny 밸런싱 방식 */}
      <details className="mt-3 pt-3 group" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <summary className="text-sm cursor-pointer list-none flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
          <span>조종자 실력 (에임 · 반응 · 판단)</span>
          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="space-y-2 mt-2">
          <SkillSlider
            icon={Crosshair}
            label="에임"
            description="명중률 · 크리티컬 보정"
            value={unitStats.aimSkill ?? 50}
            onChange={(v) => setUnitStats(prev => ({ ...prev, aimSkill: v }))}
            color="#e86161"
          />
          <SkillSlider
            icon={Gauge}
            label="반응"
            description="회피율 · 선공 확률 보정"
            value={unitStats.reactionSkill ?? 50}
            onChange={(v) => setUnitStats(prev => ({ ...prev, reactionSkill: v }))}
            color="#5a9cf5"
          />
          <SkillSlider
            icon={Brain}
            label="판단"
            description="스킬 선택 최적성 (팀전/다중 스킬)"
            value={unitStats.decisionSkill ?? 50}
            onChange={(v) => setUnitStats(prev => ({ ...prev, decisionSkill: v }))}
            color="#9179f2"
          />
        </div>
      </details>

      {/* 스킬 섹션 */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <button
          onClick={() => setShowSkills(!showSkills)}
          className="w-full flex items-center justify-between text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="flex items-center gap-2">
            {t('skills')}
            {skills.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-sm" style={{ background: `${color}20`, color }}>
                {skills.length}
              </span>
            )}
          </span>
          {showSkills ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSkills && (
          <div className="mt-2">
            <SkillEditor
              skills={skills}
              onSkillsChange={setSkills}
              color={color}
            />
          </div>
        )}
      </div>
    </div>
  );
}
