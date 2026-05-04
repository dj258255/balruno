import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TagFilterProps {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagFilter({ tags, selectedTag, onSelect }: TagFilterProps) {
  const t = useTranslations('entityDefinition');
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('tagFilter')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selectedTag && (
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="w-3 h-3" />
            {t('clearFilter')}
          </button>
        )}
        {tags.map((tag) => {
          const isSelected = selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => onSelect(isSelected ? null : tag)}
              className="px-2 py-1 rounded text-xs font-medium transition-all border"
              style={{
                background: isSelected ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: isSelected ? 'white' : 'var(--text-primary)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border-primary)',
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
