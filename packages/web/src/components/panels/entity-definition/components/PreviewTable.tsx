import { useTranslations } from 'next-intl';
import type { LevelTableRow } from '@/types';

interface PreviewTableProps {
  previewData: LevelTableRow[];
  statNames: string[];
}

const STAT_COLORS: Record<string, string> = {
  HP: '#22c55e',
  ATK: '#ef4444',
  DEF: '#3b82f6',
  SPD: '#f59e0b',
  CRIT: '#a855f7',
};

export default function PreviewTable({ previewData, statNames }: PreviewTableProps) {
  const t = useTranslations('entityDefinition');
  if (previewData.length === 0) {
    return (
      <div
        className="p-4 rounded-lg text-center text-sm"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
      >
        {t('noPreview')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('previewTitle')}
      </div>

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
                <th
                  key={stat}
                  className="px-3 py-2 text-right text-xs font-medium"
                  style={{ color: STAT_COLORS[stat] || 'var(--text-tertiary)' }}
                >
                  {stat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, index) => (
              <tr
                key={row.level}
                style={{
                  borderTop: index > 0 ? '1px solid var(--border-primary)' : undefined,
                  background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                }}
              >
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Lv.{row.level}
                </td>
                {statNames.map((stat) => {
                  const value = row.stats[stat];
                  const isOverridden = row.isOverridden[stat];

                  return (
                    <td key={stat} className="px-3 py-2 text-right">
                      <span
                        style={{
                          color: isOverridden ? '#9179f2' : 'var(--text-primary)',
                          fontWeight: isOverridden ? 600 : 400,
                        }}
                      >
                        {value?.toLocaleString() ?? '-'}
                      </span>
                      {isOverridden && (
                        <span className="ml-1 text-xs" style={{ color: '#9179f2' }}>*</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
        <span style={{ color: '#9179f2' }}>*</span>
        <span>{t('legendOverridden')}</span>
      </div>
    </div>
  );
}
