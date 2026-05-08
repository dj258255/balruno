import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/hooks';
import { X, Heart, Swords, Shield, Zap, ChevronDown, ChevronUp, Grid3X3 } from 'lucide-react';
import type { UnitStats, Skill } from '@/lib/simulation/types';
import { SkillEditor } from './SkillEditor';
import { useProjectStore } from '@/stores/projectStore';
import { Tooltip } from '@/components/ui/Tooltip';
import CustomSelect from '@/components/ui/CustomSelect';

// 셀 선택 가능한 스탯 입력 필드
function StatField({
  label,
  value,
  onChange,
  icon,
  color,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
  color: string;
  step?: string;
}) {
  const t = useTranslations();
  const [inputValue, setInputValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const { startCellSelection, cellSelectionMode } = useProjectStore();

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => {
      setInputValue(String(cellValue));
      onChange(cellValue);
    });
  };

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <label className="flex items-center gap-1 text-sm mb-1" style={{ color }}>
        {icon} {label}
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
          className="w-full input-base pr-9"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        />
        {isHovered && !cellSelectionMode.active && (
          <Tooltip content={t('teamUnitModal.cellSelect')} position="top">
            <button
              onClick={handleCellSelect}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Grid3X3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** 조종자 실력 0-100 slider (에임/반응/판단) */
function SkillRow({
  label,
  description,
  value,
  onChange,
  color,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const t = useTranslations();
  const tier = value < 30 ? t('teamUnitModal.tierBeginner') : value < 50 ? t('teamUnitModal.tierBelowAvg') : value < 70 ? t('teamUnitModal.tierAvg') : value < 85 ? t('teamUnitModal.tierSkilled') : t('teamUnitModal.tierExpert');
  return (
    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
          <span className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>{description}</span>
        </div>
        <span className="text-label font-semibold tabular-nums shrink-0" style={{ color }}>
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

// 선택적 스탯 입력 (빈 값 허용)
function OptionalStatInput({
  label,
  value,
  onChange,
  multiplier = 1,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  multiplier?: number;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(
    value !== undefined ? String(value * multiplier) : ''
  );

  useEffect(() => {
    setInputValue(value !== undefined ? String(value * multiplier) : '');
  }, [value, multiplier]);

  return (
    <div>
      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
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
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

interface UnitWithSkills extends UnitStats {
  skills?: Skill[];
}

interface TeamUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (unit: UnitWithSkills) => void;
  unit: UnitWithSkills | null;
  teamNumber: 1 | 2;
  units: UnitStats[];
  onLoadFromSheet: (unit: UnitStats) => void;
}

export function TeamUnitModal({
  isOpen,
  onClose,
  onSave,
  unit,
  teamNumber,
  units,
  onLoadFromSheet
}: TeamUnitModalProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');

  const defaultUnit: UnitWithSkills = {
    id: `team${teamNumber}_${Date.now()}`,
    name: `Unit ${teamNumber === 1 ? 'A' : 'B'}`,
    hp: 1000,
    maxHp: 1000,
    atk: 100,
    def: 50,
    speed: 1,
    skills: []
  };

  const [editUnit, setEditUnit] = useState<UnitWithSkills>(unit || defaultUnit);
  const [showSkills, setShowSkills] = useState(false);
  const color = teamNumber === 1 ? 'var(--primary-blue)' : 'var(--primary-red)';

  useEffect(() => {
    if (isOpen) {
      setEditUnit(unit || {
        ...defaultUnit,
        id: `team${teamNumber}_${Date.now()}`
      });
      setShowSkills(!!unit?.skills?.length);
    }
  }, [isOpen, unit, teamNumber]);

  // ESC 키로 닫기
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: `${color}15`, borderBottom: `2px solid ${color}` }}>
          <h3 className="font-semibold" style={{ color }}>
            {unit ? t('teamUnitModal.editUnit') : t('teamUnitModal.newUnit')} (Team {teamNumber})
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* 본문 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 시트에서 불러오기 */}
          {units.length > 0 && (
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{t('simulation.loadFromSheet')}</label>
              <CustomSelect
                value=""
                onChange={(v) => {
                  const selected = units.find(u => u.id === v);
                  if (selected) {
                    setEditUnit({
                      ...selected,
                      id: `team${teamNumber}_${Date.now()}`,
                      skills: editUnit.skills
                    });
                  }
                }}
                placeholder={t('simulation.select')}
                options={units.map(u => ({
                  value: u.id,
                  label: `${u.name} (HP:${u.maxHp} ATK:${u.atk})`
                }))}
                color={color}
                size="md"
              />
            </div>
          )}

          {/* 이름 */}
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t('teamUnitModal.colName')}</label>
            <input
              type="text"
              value={editUnit.name}
              onChange={(e) => setEditUnit(prev => ({ ...prev, name: e.target.value }))}
              className="w-full input-base"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder={t('teamUnitModal.unitNamePlaceholder')}
            />
          </div>

          {/* 스탯 그리드 */}
          <div className="grid grid-cols-2 gap-3">
            <StatField
              label="HP"
              value={editUnit.maxHp}
              onChange={(v) => setEditUnit(prev => ({ ...prev, maxHp: v, hp: v }))}
              icon={<Heart className="w-3 h-3" />}
              color="#e86161"
            />
            <StatField
              label="ATK"
              value={editUnit.atk}
              onChange={(v) => setEditUnit(prev => ({ ...prev, atk: v }))}
              icon={<Swords className="w-3 h-3" />}
              color="#e5a440"
            />
            <StatField
              label="DEF"
              value={editUnit.def}
              onChange={(v) => setEditUnit(prev => ({ ...prev, def: v }))}
              icon={<Shield className="w-3 h-3" />}
              color="#5a9cf5"
            />
            <StatField
              label="SPD"
              value={editUnit.speed}
              onChange={(v) => setEditUnit(prev => ({ ...prev, speed: v }))}
              icon={<Zap className="w-3 h-3" />}
              color="#9179f2"
              step="0.1"
            />
          </div>

          {/* 선택적 스탯 */}
          <details className="group">
            <summary className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              {t('teamUnitModal.advancedOptions')}
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <OptionalStatInput
                label={`${t('teamUnitModal.colCritRate' as 'teamUnitModal.tierBeginner') || 'Crit'} %`}
                value={editUnit.critRate}
                onChange={(v) => setEditUnit(prev => ({ ...prev, critRate: v }))}
                multiplier={100}
                placeholder="0"
              />
              <OptionalStatInput
                label={`${t('teamUnitModal.colCritDmg' as 'teamUnitModal.tierBeginner') || 'Crit dmg'} x`}
                value={editUnit.critDamage}
                onChange={(v) => setEditUnit(prev => ({ ...prev, critDamage: v }))}
                placeholder="1.5"
              />
              <OptionalStatInput
                label={t('teamUnitModal.hitRate')}
                value={editUnit.accuracy}
                onChange={(v) => setEditUnit(prev => ({ ...prev, accuracy: v }))}
                multiplier={100}
                placeholder="100"
              />
              <OptionalStatInput
                label={t('teamUnitModal.evasion')}
                value={editUnit.evasion}
                onChange={(v) => setEditUnit(prev => ({ ...prev, evasion: v }))}
                multiplier={100}
                placeholder="0"
              />
            </div>
          </details>

          {/* 조종자 실력 (Composite Skill) */}
          <details className="group">
            <summary className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              {t('teamUnitModal.pilotSkill')}
            </summary>
            <div className="space-y-2 mt-2">
              <SkillRow
                label={t('teamUnitModal.aim')}
                description={t('teamUnitModal.aimDesc')}
                value={editUnit.aimSkill ?? 50}
                onChange={(v) => setEditUnit(prev => ({ ...prev, aimSkill: v }))}
                color="#e86161"
              />
              <SkillRow
                label={t('teamUnitModal.reaction')}
                description={t('teamUnitModal.reactionDesc')}
                value={editUnit.reactionSkill ?? 50}
                onChange={(v) => setEditUnit(prev => ({ ...prev, reactionSkill: v }))}
                color="#5a9cf5"
              />
              <SkillRow
                label={t('teamUnitModal.decision')}
                description={t('teamUnitModal.decisionDesc')}
                value={editUnit.decisionSkill ?? 50}
                onChange={(v) => setEditUnit(prev => ({ ...prev, decisionSkill: v }))}
                color="#9179f2"
              />
            </div>
          </details>

          {/* 스킬 섹션 */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border-primary)' }}
          >
            <button
              onClick={() => setShowSkills(!showSkills)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              <span className="flex items-center gap-2">
                {t('simulation.skills')}
                {editUnit.skills && editUnit.skills.length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-sm"
                    style={{ background: `${color}20`, color }}
                  >
                    {editUnit.skills.length}
                  </span>
                )}
              </span>
              {showSkills ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSkills && (
              <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
                <SkillEditor
                  skills={editUnit.skills || []}
                  onSkillsChange={(skills) => setEditUnit(prev => ({ ...prev, skills }))}
                  color={color}
                  isTeamBattle={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={() => {
              onSave(editUnit);
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: color, color: 'white' }}
          >
            {unit ? tCommon('save') : tCommon('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
