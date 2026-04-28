'use client';

import { Users, Skull, Bot, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { EntityDefinition } from '@/types';

interface EntitySelectorProps {
  entities: EntityDefinition[];
  selectedEntityId: string | null;
  onSelect: (entityId: string | null) => void;
  isColumnMapped?: boolean;  // ID/이름 컬럼이 매핑되었는지 여부
}

const ENTITY_TYPE_ICONS: Record<EntityDefinition['entityType'], React.ElementType> = {
  character: Users,
  monster: Skull,
  npc: Bot,
  item: Package,
};

const ENTITY_TYPE_COLORS: Record<EntityDefinition['entityType'], string> = {
  character: '#5a9cf5',
  monster: '#ef4444',
  npc: '#22c55e',
  item: '#f59e0b',
};

// 숫자 포맷팅 (천단위 콤마 + 소수점 4자리까지)
function formatStatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  // 소수점 4자리까지 표시, 불필요한 0 제거
  const formatted = value.toFixed(4).replace(/\.?0+$/, '');
  // 천단위 콤마 적용
  const [intPart, decPart] = formatted.split('.');
  const intFormatted = Number(intPart).toLocaleString();
  return decPart ? `${intFormatted}.${decPart}` : intFormatted;
}

export default function EntitySelector({
  entities,
  selectedEntityId,
  onSelect,
  isColumnMapped = true,
}: EntitySelectorProps) {
  const t = useTranslations('entityDefinition');
  // 컬럼이 매핑되지 않은 경우
  if (!isColumnMapped) {
    return (
      <div
        className="p-4 rounded-lg text-center text-sm"
        style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--text-secondary)' }}
      >
        <p style={{ color: '#f59e0b' }}>{t('needColumnMapping')}</p>
        <p className="mt-1 text-xs">
          {t('needColumnMappingHelp')}
        </p>
      </div>
    );
  }

  // 컬럼은 매핑되었지만 엔티티가 없는 경우
  if (entities.length === 0) {
    return (
      <div
        className="p-4 rounded-lg text-center text-sm"
        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--text-secondary)' }}
      >
        <p style={{ color: '#ef4444' }}>{t('noEntity')}</p>
        <p className="mt-1 text-xs">
          {t('noEntityHelp1')}<br />
          {t('noEntityHelp2')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
        {t('entitySelect', { count: entities.length })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {entities.map((entity) => {
          const isSelected = entity.id === selectedEntityId;
          const Icon = ENTITY_TYPE_ICONS[entity.entityType] || Users;
          const color = ENTITY_TYPE_COLORS[entity.entityType] || '#5a9cf5';

          return (
            <button
              key={entity.id}
              onClick={() => onSelect(isSelected ? null : entity.id)}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                background: isSelected ? `${color}20` : 'var(--bg-secondary)',
                border: `1px solid ${isSelected ? color : 'var(--border-primary)'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: `${color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {entity.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Lv.1~{entity.maxLevel}
                  </div>
                </div>
              </div>

              {/* 기본 스탯 미리보기 */}
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs overflow-hidden" style={{ color: 'var(--text-tertiary)' }}>
                {entity.baseStats.HP !== undefined && <span className="truncate">HP:{formatStatValue(entity.baseStats.HP)}</span>}
                {entity.baseStats.ATK !== undefined && <span className="truncate">ATK:{formatStatValue(entity.baseStats.ATK)}</span>}
                {entity.baseStats.DEF !== undefined && <span className="truncate">DEF:{formatStatValue(entity.baseStats.DEF)}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
