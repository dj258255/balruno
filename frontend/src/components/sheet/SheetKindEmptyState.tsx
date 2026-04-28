'use client';

/**
 * 시트가 비어있을 때 (rows.length === 0) 표시되는 안내 카드.
 *
 * 목적: 처음 시트를 연 유저에게 "이 시트는 무엇이며, 어떤 컬럼/데이터가 어울리는지" 를
 * 친절히 알려줌. 단순 "데이터 없음" 보다 도메인 컨텍스트 제공.
 *
 * kind 별 가이드:
 *  - game-data: 캐릭터/무기/스킬 같은 정적 밸런스 데이터. 엔진 export 가능.
 *  - pm: 스프린트 백로그/버그/플레이테스트. 칸반/간트 뷰 활용.
 *  - analysis: 시뮬 결과/민감도/스냅샷. 일회성/임시.
 *  - reference: 벤치마크/이전 버전. 읽기 위주.
 */

import { Database, Kanban, BarChart3, BookMarked, Plus, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Sheet } from '@/types';
import { resolveSheetKind } from '@/lib/sheetKind';

interface KindGuide {
  Icon: typeof Database;
  titleKey: string;
  introKey: string;
  exampleKeys: string[];
  toolKeys: string[];
}

const GUIDES: Record<string, KindGuide> = {
  'game-data': {
    Icon: Database,
    titleKey: 'sheet.kindGameDataTitle',
    introKey: 'sheet.kindGameDataIntro',
    exampleKeys: ['sheet.kindGameDataEx1', 'sheet.kindGameDataEx2', 'sheet.kindGameDataEx3', 'sheet.kindGameDataEx4'],
    toolKeys: ['sheet.kindGameDataTool1', 'sheet.kindGameDataTool2', 'sheet.kindGameDataTool3'],
  },
  'pm': {
    Icon: Kanban,
    titleKey: 'sheet.kindPmTitle',
    introKey: 'sheet.kindPmIntro',
    exampleKeys: ['sheet.kindPmEx1', 'sheet.kindPmEx2', 'sheet.kindPmEx3'],
    toolKeys: ['sheet.kindPmTool1', 'sheet.kindPmTool2', 'sheet.kindPmTool3'],
  },
  'analysis': {
    Icon: BarChart3,
    titleKey: 'sheet.kindAnalysisTitle',
    introKey: 'sheet.kindAnalysisIntro',
    exampleKeys: ['sheet.kindAnalysisEx1', 'sheet.kindAnalysisEx2', 'sheet.kindAnalysisEx3'],
    toolKeys: ['sheet.kindAnalysisTool1', 'sheet.kindAnalysisTool2', 'sheet.kindAnalysisTool3'],
  },
  'reference': {
    Icon: BookMarked,
    titleKey: 'sheet.kindRefTitle',
    introKey: 'sheet.kindRefIntro',
    exampleKeys: ['sheet.kindRefEx1', 'sheet.kindRefEx2', 'sheet.kindRefEx3'],
    toolKeys: ['sheet.kindRefTool1'],
  },
};

interface Props {
  sheet: Sheet;
  onAddRow: () => void;
}

export default function SheetKindEmptyState({ sheet, onAddRow }: Props) {
  const t = useTranslations();
  const meta = resolveSheetKind(sheet);
  const guide = GUIDES[meta.kind];
  if (!guide) return null;
  const { Icon } = guide;

  return (
    <div className="w-full h-full flex items-center justify-center p-8" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="max-w-2xl w-full rounded-2xl border p-8 space-y-5"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {/* 헤더 — kind 색 강조 */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${meta.color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t(guide.titleKey as 'sheet.kindGameDataTitle')}
              </h2>
              {meta.source === 'auto-pm' && (
                <span
                  className="text-caption px-1.5 py-0.5 rounded"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                  title={t('sheet.kindAutoDetectTitle')}
                >
                  {t('sheet.kindAutoDetectLabel')}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t(guide.introKey as 'sheet.kindGameDataIntro')}
            </p>
          </div>
        </div>

        {/* 예시 데이터 */}
        <div>
          <div className="text-overline mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('sheet.kindSuitableData')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {guide.exampleKeys.map((key, i) => (
              <div
                key={i}
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
              >
                {t(key as 'sheet.kindGameDataEx1')}
              </div>
            ))}
          </div>
        </div>

        {/* 추천 도구 */}
        <div>
          <div className="text-overline mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
            <Sparkles className="w-3 h-3" />
            {t('sheet.kindMatchingTools')}
          </div>
          <ul className="space-y-1">
            {guide.toolKeys.map((key, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: meta.color }}>·</span>
                <span>{t(key as 'sheet.kindGameDataTool1')}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onAddRow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus className="w-4 h-4" />
            {t('sheet.kindAddFirstRow')}
          </button>
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('sheet.kindChangeKindHint')}
          </span>
        </div>
      </div>
    </div>
  );
}
