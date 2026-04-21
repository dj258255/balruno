'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Zap, Heart, Shield, RotateCcw, Target, Users, Grid3X3 } from 'lucide-react';
import type { Skill, SkillType } from '@/lib/simulation/types';
import { useProjectStore } from '@/stores/projectStore';
import CustomSelect from '@/components/ui/CustomSelect';

interface SkillEditorProps {
  skills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
  color?: string;
  isTeamBattle?: boolean;  // 팀전 여부 (1v1에서는 타인부활 비활성화)
}

const SKILL_TYPES: { type: SkillType; icon: typeof Zap; label: string; desc: string; color: string }[] = [
  { type: 'damage', icon: Zap, label: 'skillDamage', desc: 'skillDamageDesc', color: '#e5944a' },
  { type: 'heal', icon: Heart, label: 'skillHeal', desc: 'skillHealDesc', color: '#3db88a' },
  { type: 'hot', icon: Heart, label: 'skillHoT', desc: 'skillHoTDesc', color: '#3db88a' },
  { type: 'invincible', icon: Shield, label: 'skillInvincible', desc: 'skillInvincibleDesc', color: '#5a9cf5' },
  { type: 'revive', icon: RotateCcw, label: 'skillRevive', desc: 'skillReviveDesc', color: '#a896f5' },
  { type: 'aoe_damage', icon: Target, label: 'skillAoeDamage', desc: 'skillAoeDamageDesc', color: '#e86161' },
  { type: 'aoe_heal', icon: Users, label: 'skillAoeHeal', desc: 'skillAoeHealDesc', color: '#3db8a8' },
];

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  color: string;
}

function Tooltip({ children, content, color }: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHovered && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const y = triggerRect.top - tooltipRect.height - 8;

      // Prevent tooltip from going off-screen
      if (x < 8) x = 8;
      if (x + tooltipRect.width > window.innerWidth - 8) {
        x = window.innerWidth - tooltipRect.width - 8;
      }

      setPosition({ x, y });
      setIsPositioned(true);
    } else {
      setIsPositioned(false);
    }
  }, [isHovered]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative inline-block"
    >
      {children}
      {isHovered && (
        <div
          ref={tooltipRef}
          className="fixed z-[1100] px-3 py-2 rounded-lg shadow-lg text-sm max-w-[200px] pointer-events-none transition-opacity duration-150"
          style={{
            left: position.x,
            top: position.y,
            opacity: isPositioned ? 1 : 0,
            background: 'var(--bg-primary)',
            border: `1px solid ${color}`,
            color: 'var(--text-primary)',
            boxShadow: `0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${color}30`
          }}
        >
          {content}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
            style={{
              bottom: -5,
              background: 'var(--bg-primary)',
              borderRight: `1px solid ${color}`,
              borderBottom: `1px solid ${color}`
            }}
          />
        </div>
      )}
    </div>
  );
}

const TRIGGER_TYPES = [
  { type: 'always' as const, label: 'triggerAlways' },
  { type: 'hp_below' as const, label: 'triggerHpBelow' },
  { type: 'hp_above' as const, label: 'triggerHpAbove' },
  { type: 'on_hit' as const, label: 'triggerOnHit' },
  { type: 'on_crit' as const, label: 'triggerOnCrit' },
];

// 셀 선택 가능한 숫자 입력 컴포넌트
interface NumberInputWithCellProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

function NumberInputWithCell({ label, value, onChange, placeholder }: NumberInputWithCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const { startCellSelection, cellSelectionMode } = useProjectStore();

  // 외부에서 값이 변경될 때만 동기화 (사용자 입력 중이 아닐 때)
  const [lastExternalValue, setLastExternalValue] = useState(value);
  useEffect(() => {
    if (value !== lastExternalValue) {
      setInputValue(String(value));
      setLastExternalValue(value);
    }
  }, [value, lastExternalValue]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => {
      const num = Number(cellValue);
      if (!isNaN(num)) {
        setInputValue(String(num));
        setLastExternalValue(num);
        onChange(num);
      }
    });
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          placeholder={placeholder || '0'}
          onChange={(e) => {
            const newValue = e.target.value;
            if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
              setInputValue(newValue);
              if (newValue !== '') {
                const num = parseFloat(newValue);
                if (!isNaN(num)) {
                  setLastExternalValue(num);
                  onChange(num);
                }
              }
            }
          }}
          className="w-full px-2 py-1.5 pr-7 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        />
        {isHovered && !cellSelectionMode?.active && (
          <button
            onClick={handleCellSelect}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            title="셀에서 값 가져오기"
          >
            <Grid3X3 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>
    </div>
  );
}

export function SkillEditor({ skills, onSkillsChange, color = 'var(--primary-blue)', isTeamBattle = false }: SkillEditorProps) {
  const t = useTranslations('simulation');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const addSkill = (type: SkillType) => {
    const newSkill: Skill = {
      id: `skill_${Date.now()}`,
      name: t(SKILL_TYPES.find(s => s.type === type)?.label || 'skillDamage'),
      damage: type === 'damage' || type === 'aoe_damage' ? 1.5 : 0,
      damageType: 'multiplier',
      cooldown: 5,
      skillType: type,
      trigger: { type: 'always', chance: 1 },
      // 스킬 타입별 기본값
      ...(type === 'heal' && { healAmount: 0.2, healType: 'percent' as const }),
      ...(type === 'hot' && { hotDuration: 5, hotTickInterval: 1, hotAmount: 0.05, hotType: 'percent' as const }),
      ...(type === 'invincible' && { invincibleDuration: 2 }),
      ...(type === 'revive' && {
        reviveHpPercent: 0.3,
        reviveTarget: isTeamBattle ? 'ally' as const : 'self' as const,  // 1v1에서는 자기부활만 가능
        trigger: { type: 'always' as const, chance: 0.5 }
      }),
      ...(type === 'aoe_damage' && { aoeTargetCount: undefined, aoeTargetMode: 'all' as const }),
      ...(type === 'aoe_heal' && { healAmount: 0.15, healType: 'percent' as const, aoeTargetCount: undefined, aoeTargetMode: 'all' as const }),
    };
    onSkillsChange([...skills, newSkill]);
    setExpandedSkill(newSkill.id);
  };

  const updateSkill = (id: string, updates: Partial<Skill>) => {
    onSkillsChange(skills.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSkill = (id: string) => {
    onSkillsChange(skills.filter(s => s.id !== id));
    if (expandedSkill === id) setExpandedSkill(null);
  };

  const getSkillTypeInfo = (type: SkillType) => {
    return SKILL_TYPES.find(s => s.type === type) || SKILL_TYPES[0];
  };

  return (
    <div className="space-y-3">
      {/* 스킬 추가 버튼들 */}
      <div className="flex flex-wrap gap-1">
        {SKILL_TYPES.map(({ type, icon: Icon, label, desc, color: skillColor }) => (
          <Tooltip
            key={type}
            content={`${t(label)}: ${t(desc)}`}
            color={skillColor}
          >
            <button
              onClick={() => addSkill(type)}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm transition-all hover:scale-105"
              style={{
                background: `${skillColor}20`,
                color: skillColor,
                border: `1px solid ${skillColor}40`
              }}
            >
              <Icon className="w-3 h-3" />
              <Plus className="w-2.5 h-2.5" />
            </button>
          </Tooltip>
        ))}
      </div>

      {/* 스킬 목록 */}
      {skills.length > 0 && (
        <div className="space-y-2">
          {skills.map(skill => {
            const typeInfo = getSkillTypeInfo(skill.skillType || 'damage');
            const isExpanded = expandedSkill === skill.id;
            const Icon = typeInfo.icon;

            return (
              <div
                key={skill.id}
                className="rounded-lg overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: `1px solid ${typeInfo.color}30` }}
              >
                {/* 스킬 헤더 */}
                <div
                  className="flex items-center justify-between p-2 cursor-pointer hover:bg-black/5"
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: `${typeInfo.color}20` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: typeInfo.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {skill.name}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        CD: {skill.cooldown}s
                        {skill.trigger?.chance && skill.trigger.chance < 1 && ` | ${Math.round(skill.trigger.chance * 100)}%`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSkill(skill.id); }}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>

                {/* 스킬 상세 설정 */}
                {isExpanded && (
                  <div className="p-3 border-t space-y-3" style={{ borderColor: 'var(--border-primary)' }}>
                    {/* 스킬 이름 */}
                    <div>
                      <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        {t('skillName')}
                      </label>
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => updateSkill(skill.id, { name: e.target.value })}
                        className="w-full input-base"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    {/* 쿨다운 */}
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInputWithCell
                        label={`${t('cooldown')} (s)`}
                        value={skill.cooldown}
                        onChange={(v) => updateSkill(skill.id, { cooldown: v })}
                        min={0}
                        step={0.5}
                      />

                      {/* 발동 확률 */}
                      <NumberInputWithCell
                        label={`${t('triggerChance')} (%)`}
                        value={Math.round((skill.trigger?.chance ?? 1) * 100)}
                        onChange={(v) => updateSkill(skill.id, {
                          trigger: { ...skill.trigger, type: skill.trigger?.type || 'always', chance: v / 100 }
                        })}
                        min={1}
                        max={100}
                      />
                    </div>

                    {/* 트리거 타입 */}
                    <div>
                      <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                        {t('triggerCondition')}
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {TRIGGER_TYPES.map(({ type, label }) => (
                          <button
                            key={type}
                            onClick={() => updateSkill(skill.id, {
                              trigger: { ...skill.trigger, type, chance: skill.trigger?.chance || 1 }
                            })}
                            className="px-2 py-1 rounded text-sm transition-colors"
                            style={{
                              background: skill.trigger?.type === type ? `${color}30` : 'var(--bg-secondary)',
                              color: skill.trigger?.type === type ? color : 'var(--text-secondary)',
                              border: `1px solid ${skill.trigger?.type === type ? color : 'var(--border-primary)'}`
                            }}
                          >
                            {t(label)}
                          </button>
                        ))}
                      </div>
                      {(skill.trigger?.type === 'hp_below' || skill.trigger?.type === 'hp_above') && (
                        <div className="mt-2">
                          <NumberInputWithCell
                            label={`HP ${t('threshold')} (%)`}
                            value={Math.round((skill.trigger?.value || 0.5) * 100)}
                            onChange={(v) => updateSkill(skill.id, {
                              trigger: { ...skill.trigger, type: skill.trigger?.type || 'always', value: v / 100 }
                            })}
                            min={1}
                            max={99}
                          />
                        </div>
                      )}
                    </div>

                    {/* 스킬 타입별 설정 */}
                    {(skill.skillType === 'damage' || skill.skillType === 'aoe_damage') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('damageType')}
                          </label>
                          <CustomSelect
                            value={skill.damageType}
                            onChange={(v) => updateSkill(skill.id, { damageType: v as 'flat' | 'multiplier' })}
                            options={[
                              { value: 'multiplier', label: t('atkMultiplier') },
                              { value: 'flat', label: t('flatDamage') },
                            ]}
                            size="sm"
                          />
                        </div>
                        <NumberInputWithCell
                          label={skill.damageType === 'multiplier' ? t('multiplier') : t('damage')}
                          value={skill.damage}
                          onChange={(v) => updateSkill(skill.id, { damage: v })}
                          min={0}
                          step={skill.damageType === 'multiplier' ? 0.1 : 1}
                        />
                      </div>
                    )}

                    {(skill.skillType === 'heal' || skill.skillType === 'aoe_heal') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('healType')}
                          </label>
                          <CustomSelect
                            value={skill.healType || 'percent'}
                            onChange={(v) => updateSkill(skill.id, { healType: v as 'flat' | 'percent' })}
                            options={[
                              { value: 'percent', label: t('percentHeal') },
                              { value: 'flat', label: t('flatHeal') },
                            ]}
                            size="sm"
                          />
                        </div>
                        <NumberInputWithCell
                          label={skill.healType === 'percent' ? t('healPercent') : t('healAmount')}
                          value={skill.healType === 'percent' ? Math.round((skill.healAmount || 0) * 100) : (skill.healAmount || 0)}
                          onChange={(v) => updateSkill(skill.id, {
                            healAmount: skill.healType === 'percent' ? v / 100 : v
                          })}
                          min={0}
                        />
                      </div>
                    )}

                    {skill.skillType === 'hot' && (
                      <div className="grid grid-cols-3 gap-2">
                        <NumberInputWithCell
                          label={`${t('duration')} (s)`}
                          value={skill.hotDuration || 5}
                          onChange={(v) => updateSkill(skill.id, { hotDuration: v })}
                          min={1}
                        />
                        <NumberInputWithCell
                          label={`${t('tickInterval')} (s)`}
                          value={skill.hotTickInterval || 1}
                          onChange={(v) => updateSkill(skill.id, { hotTickInterval: v })}
                          min={0.1}
                          step={0.1}
                        />
                        <NumberInputWithCell
                          label={`${t('tickHeal')} (%)`}
                          value={Math.round((skill.hotAmount || 0.05) * 100)}
                          onChange={(v) => updateSkill(skill.id, { hotAmount: v / 100 })}
                          min={1}
                        />
                      </div>
                    )}

                    {skill.skillType === 'invincible' && (
                      <NumberInputWithCell
                        label={`${t('invincibleDuration')} (s)`}
                        value={skill.invincibleDuration || 2}
                        onChange={(v) => updateSkill(skill.id, { invincibleDuration: v })}
                        min={0.1}
                        step={0.1}
                      />
                    )}

                    {skill.skillType === 'revive' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('reviveTarget')}
                          </label>
                          {isTeamBattle ? (
                            <CustomSelect
                              value={skill.reviveTarget || 'ally'}
                              onChange={(v) => updateSkill(skill.id, { reviveTarget: v as 'self' | 'ally' })}
                              options={[
                                { value: 'self', label: t('reviveTargetSelf') },
                                { value: 'ally', label: t('reviveTargetAlly') },
                              ]}
                              size="sm"
                            />
                          ) : (
                            <div
                              className="w-full input-base"
                              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
                              title={t('reviveAllyOnlyTeam')}
                            >
                              {t('reviveTargetSelf')}
                            </div>
                          )}
                        </div>
                        <NumberInputWithCell
                          label={`${t('reviveHpPercent')} (%)`}
                          value={Math.round((skill.reviveHpPercent || 0.3) * 100)}
                          onChange={(v) => updateSkill(skill.id, { reviveHpPercent: v / 100 })}
                          min={1}
                          max={100}
                        />
                      </div>
                    )}

                    {(skill.skillType === 'aoe_damage' || skill.skillType === 'aoe_heal') && (
                      <div className="grid grid-cols-2 gap-2">
                        <NumberInputWithCell
                          label={t('aoeTargetCount')}
                          value={skill.aoeTargetCount || 0}
                          onChange={(v) => updateSkill(skill.id, {
                            aoeTargetCount: v > 0 ? v : undefined
                          })}
                          min={0}
                          placeholder={t('all')}
                        />
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                            {t('aoeTargetMode')}
                          </label>
                          <CustomSelect
                            value={skill.aoeTargetMode || 'all'}
                            onChange={(v) => updateSkill(skill.id, { aoeTargetMode: v as Skill['aoeTargetMode'] })}
                            options={[
                              { value: 'all', label: t('targetAll') },
                              { value: 'random', label: t('targetRandom') },
                              { value: 'lowest_hp', label: t('targetLowestHp') },
                              { value: 'highest_hp', label: t('targetHighestHp') },
                            ]}
                            size="sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {skills.length === 0 && (
        <div
          className="text-center py-4 rounded-lg text-sm"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
        >
          {t('noSkills')}
        </div>
      )}
    </div>
  );
}
