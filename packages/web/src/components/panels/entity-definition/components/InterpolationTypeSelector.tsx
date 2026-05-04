import { useTranslations } from 'next-intl';
import type { InterpolationType } from '@/types';

interface InterpolationTypeSelectorProps {
  value: InterpolationType;
  onChange: (value: InterpolationType) => void;
}

export default function InterpolationTypeSelector({ value, onChange }: InterpolationTypeSelectorProps) {
  const t = useTranslations('entityDefinition');
  const INTERPOLATION_TYPES: { value: InterpolationType; label: string; description: string }[] = [
    { value: 'linear', label: t('interpLinear'), description: t('interpLinearDesc') },
    { value: 'step', label: t('interpStep'), description: t('interpStepDesc') },
    { value: 'ease-in-out', label: t('interpEase'), description: t('interpEaseDesc') },
  ];
  const isSelected = (type: InterpolationType) => value === type;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('interpolationTitle')}
      </div>
      <div className="flex gap-2">
        {INTERPOLATION_TYPES.map((type) => {
          const selected = isSelected(type.value);
          return (
            <button
              key={type.value}
              onClick={() => onChange(type.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: selected ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: selected ? 'white' : 'var(--text-primary)',
                borderColor: selected ? 'var(--accent)' : 'var(--border-primary)',
              }}
              title={type.description}
            >
              {type.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {INTERPOLATION_TYPES.find(t => t.value === value)?.description}
      </p>
    </div>
  );
}
