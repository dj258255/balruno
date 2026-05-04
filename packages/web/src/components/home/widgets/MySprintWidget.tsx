import { Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TodaysWork, RowWithContext } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

export default function MySprintWidget({ work }: { work: TodaysWork }) {
  const t = useTranslations('home');
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  const jump = (ctx: RowWithContext) => {
    setCurrentProject(ctx.projectId);
    setCurrentSheet(ctx.sheet.id);
    const firstCol = ctx.sheet.columns.find((c) => c.type === 'general');
    if (firstCol) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('balruno:focus-cell', {
            detail: { sheetId: ctx.sheet.id, rowId: ctx.row.id, columnId: firstCol.id },
          })
        );
      }, 50);
    }
  };

  const getTitle = (ctx: RowWithContext): string => {
    const titleCol = ctx.sheet.columns.find(
      (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
    );
    if (!titleCol) return t('noTitle');
    const v = ctx.row.cells[titleCol.id];
    return v ? String(v) : t('noTitle');
  };

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #3b82f6' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: '#3b82f6' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('mySprint')}
          </h3>
        </div>
        <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
          {work.mySprint.length}
        </div>
      </div>
      {work.mySprint.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
          {work.activeSprint.length > 0
            ? t('mySprintEmptyWithCount', { count: work.activeSprint.length })
            : t('mySprintEmpty')}
        </p>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {work.mySprint.map((ctx, i) => (
            <button
              key={i}
              onClick={() => jump(ctx)}
              className="w-full text-left px-2 py-1 rounded text-xs truncate hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-primary)' }}
            >
              • {getTitle(ctx)}
              <span className="ml-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
                {ctx.projectName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
