import { Plus, X, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { StatOverride, EntityDefinition } from '@/types';

interface OverrideEditorProps {
  entity: EntityDefinition;
  overrides: StatOverride[];
  onAdd: (level: number) => void;
  onRemove: (level: number) => void;
  onUpdate: (level: number, statName: string, value: number) => void;
  maxLevel: number;
}

export default function OverrideEditor({
  entity,
  overrides,
  onAdd,
  onRemove,
  onUpdate,
  maxLevel,
}: OverrideEditorProps) {
  const t = useTranslations('entityDefinition');
  const [newLevel, setNewLevel] = useState<number>(10);
  const [editingCell, setEditingCell] = useState<{ level: number; stat: string } | null>(null);

  const statNames = Object.keys(entity.baseStats);

  const handleAddOverride = () => {
    if (newLevel >= 1 && newLevel <= maxLevel && !overrides.some(o => o.level === newLevel)) {
      onAdd(newLevel);
      // 다음 빈 레벨로 이동
      const usedLevels = new Set(overrides.map(o => o.level));
      usedLevels.add(newLevel);
      for (let l = newLevel + 5; l <= maxLevel; l += 5) {
        if (!usedLevels.has(l)) {
          setNewLevel(l);
          break;
        }
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('overrideEditorTitle', { count: overrides.length })}
        </div>
      </div>

      {/* 설명 */}
      <div
        className="px-3 py-2 rounded-lg text-xs"
        style={{ background: 'rgba(145, 121, 242, 0.08)', color: 'var(--text-tertiary)' }}
      >
        {t('overrideEditorHelp')}
      </div>

      {/* 오버라이드 추가 */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={newLevel}
          onChange={(e) => setNewLevel(parseInt(e.target.value) || 1)}
          min={1}
          max={maxLevel}
          placeholder={t('levelInput')}
          className="w-20 input-base hide-spinner"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={handleAddOverride}
          disabled={overrides.some(o => o.level === newLevel)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          style={{
            background: '#9179f220',
            color: '#9179f2',
          }}
        >
          <Plus className="w-4 h-4" />
          {t('addLevel', { n: newLevel })}
        </button>
      </div>

      {/* 오버라이드 목록 */}
      {overrides.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-primary)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {t('levelHeader')}
                </th>
                {statNames.map((stat) => (
                  <th key={stat} className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {stat}
                  </th>
                ))}
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((override) => (
                <tr
                  key={override.level}
                  style={{ borderTop: '1px solid var(--border-primary)' }}
                >
                  <td className="px-3 py-2 font-medium" style={{ color: '#9179f2' }}>
                    Lv.{override.level}
                  </td>
                  {statNames.map((stat) => {
                    const isEditing = editingCell?.level === override.level && editingCell?.stat === stat;
                    const value = override.stats[stat];

                    return (
                      <td key={stat} className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            defaultValue={value}
                            autoFocus
                            onBlur={(e) => {
                              const newValue = parseInt(e.target.value) || 0;
                              onUpdate(override.level, stat, newValue);
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newValue = parseInt((e.target as HTMLInputElement).value) || 0;
                                onUpdate(override.level, stat, newValue);
                                setEditingCell(null);
                              }
                              if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-20 input-base text-right hide-spinner"
                            style={{
                              background: 'var(--bg-primary)',
                              border: '1px solid #9179f2',
                              color: 'var(--text-primary)',
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingCell({ level: override.level, stat })}
                            className="flex items-center gap-1 ml-auto hover:text-purple-400 transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {value?.toLocaleString() ?? '-'}
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onRemove(override.level)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
