'use client';

/**
 * AI Behavior Tree 룰 에디터 패널.
 * 조건 → 액션 규칙 체인. 미리 정의된 preset 로드 + 커스텀 규칙.
 * 규칙은 simulation engine 에서 decisionSkill 과 함께 사용.
 */

import { useState } from 'react';
import { Brain, Plus, Trash2, Sparkles, GripVertical } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  RULE_PRESETS,
  CONDITION_LABELS,
  ACTION_LABELS,
  type BehaviorRule,
  type BehaviorCondition,
  type BehaviorAction,
  type ConditionOp,
} from '@/lib/aiBehavior';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

export default function AIBehaviorPanel({ onClose }: Props) {
  const t = useTranslations();
  const [rules, setRules] = useState<BehaviorRule[]>(RULE_PRESETS.tactical);

  const loadPreset = (key: string) => {
    if (RULE_PRESETS[key]) setRules(RULE_PRESETS[key]);
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        name: t('aiBehavior.newRule'),
        condition: { type: 'always' },
        action: { type: 'attack' },
      },
    ]);
  };

  const updateRule = (idx: number, patch: Partial<BehaviorRule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => setRules((prev) => prev.filter((_, i) => i !== idx));

  const moveRule = (idx: number, dir: -1 | 1) => {
    setRules((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <PanelShell
      title={t('aiBehavior.titleHeader')}
      subtitle={t('aiBehavior.subtitleHeader')}
      icon={Brain}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 프리셋 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('aiBehavior.loadPreset')}
        </div>
        <div className="flex gap-2">
          {Object.keys(RULE_PRESETS).map((key) => (
            <button
              key={key}
              onClick={() => loadPreset(key)}
              className="btn-secondary text-label inline-flex items-center gap-1 capitalize"
            >
              <Sparkles className="w-3 h-3" />
              {key}
            </button>
          ))}
        </div>
        <p className="text-caption italic mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('aiBehavior.presetExplain')}
        </p>
      </div>

      {/* 규칙 목록 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('aiBehavior.rulesHeader', { n: rules.length })}
          </span>
          <button onClick={addRule} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t('aiBehavior.addRule')}
          </button>
        </div>

        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              idx={idx}
              total={rules.length}
              onUpdate={(patch) => updateRule(idx, patch)}
              onRemove={() => removeRule(idx)}
              onMove={(dir) => moveRule(idx, dir)}
            />
          ))}
          {rules.length === 0 && (
            <p className="text-caption italic text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
              {t('aiBehavior.noRules')}
            </p>
          )}
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('aiBehavior.evaluationHelp')}
      </div>
    </PanelShell>
  );
}

function RuleEditor({
  rule,
  idx,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  rule: BehaviorRule;
  idx: number;
  total: number;
  onUpdate: (patch: Partial<BehaviorRule>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = useTranslations();
  const showValue = rule.condition.type !== 'always';

  return (
    <div className="p-2 rounded-md space-y-1.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={idx === 0} className="opacity-40 hover:opacity-100 disabled:opacity-20">
            <GripVertical className="w-3 h-3" />
          </button>
        </div>
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          #{idx + 1}
        </span>
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-compact flex-1 min-w-0"
          placeholder={t('aiBehavior.rulePlaceholder')}
        />
        <button onClick={() => onMove(1)} disabled={idx === total - 1} className="opacity-40 hover:opacity-100 disabled:opacity-20 text-label">
          ↓
        </button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
          <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-label">
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('aiBehavior.ifLabel')}</span>
        <select
          value={rule.condition.type}
          onChange={(e) =>
            onUpdate({
              condition: {
                type: e.target.value as BehaviorCondition['type'],
                op: rule.condition.op ?? '<',
                value: rule.condition.value ?? 50,
              },
            })
          }
          className="input-compact"
        >
          {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map((k) => (
            <option key={k} value={k}>{CONDITION_LABELS[k]}</option>
          ))}
        </select>
        {showValue && (
          <>
            <select
              value={rule.condition.op ?? '<'}
              onChange={(e) => onUpdate({ condition: { ...rule.condition, op: e.target.value as ConditionOp } })}
              className="input-compact"
              style={{ width: 60 }}
            >
              {(['<', '<=', '>', '>=', '==', '!='] as const).map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <input
              type="number"
              value={rule.condition.value ?? 0}
              onChange={(e) => onUpdate({ condition: { ...rule.condition, value: parseFloat(e.target.value) || 0 } })}
              className="input-compact hide-spinner"
              style={{ width: 70 }}
            />
          </>
        )}

        <span className="text-caption ml-2" style={{ color: 'var(--text-tertiary)' }}>→</span>

        <select
          value={rule.action.type}
          onChange={(e) =>
            onUpdate({ action: { type: e.target.value as BehaviorAction['type'] } as BehaviorAction })
          }
          className="input-compact flex-1"
        >
          {(Object.keys(ACTION_LABELS) as (keyof typeof ACTION_LABELS)[]).map((k) => (
            <option key={k} value={k}>{ACTION_LABELS[k]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
