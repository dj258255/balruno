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
import type { Sheet } from '@/types';
import { resolveSheetKind } from '@/lib/sheetKind';

interface KindGuide {
  Icon: typeof Database;
  title: string;
  intro: string;
  examples: string[];
  recommendedTools: string[];
}

const GUIDES: Record<string, KindGuide> = {
  'game-data': {
    Icon: Database,
    title: '게임 데이터 시트',
    intro: '빌드에 들어가는 정적 밸런스 데이터를 행 단위로 관리합니다. Unity/Unreal/JSON 으로 export 가능.',
    examples: ['캐릭터 (이름, HP, ATK, DEF, 스킬)', '무기 (타입, 데미지, 사거리, 쿨다운)', '레벨 곡선 (레벨, 필요 EXP, 보상)', '아이템 (등급, 효과, 가격)'],
    recommendedTools: ['수식 헬퍼로 컬럼 자동 계산', '엔티티 정의로 1~200렙 일괄 생성', '경제 워크벤치로 자원 흐름 시뮬'],
  },
  'pm': {
    Icon: Kanban,
    title: '팀 PM 시트',
    intro: '스프린트 백로그·버그·로드맵 같은 작업 관리. 빌드에는 들어가지 않으며 칸반/간트/캘린더 뷰가 잘 어울립니다.',
    examples: ['스프린트 백로그 (작업, 상태, 담당자, due)', '버그 트래킹 (제목, 심각도, status)', '플레이테스트 결과 (테스터, 단계, 피드백)'],
    recommendedTools: ['칸반 뷰로 status 별 카드 정렬', '간트 뷰로 일정 시각화', '필터로 내 작업/이번 스프린트 만 보기'],
  },
  'analysis': {
    Icon: BarChart3,
    title: '분석 시트',
    intro: '시뮬 결과·민감도 분석·스냅샷 같은 일회성 데이터. 빌드에는 들어가지 않습니다.',
    examples: ['Monte Carlo 결과 (run, winner, duration)', '민감도 표 (변수, 출력, 영향도)', '밸런스 비교 스냅샷 (버전, 핵심 지표)'],
    recommendedTools: ['전투 시뮬 결과를 시트로 commit', '민감도 분석 패널', '비교 차트로 시각화'],
  },
  'reference': {
    Icon: BookMarked,
    title: '참조 시트',
    intro: '벤치마크·이전 버전·외부 자료처럼 읽기 위주의 정적 자료.',
    examples: ['경쟁작 밸런스 벤치마크', '이전 빌드의 데이터 스냅샷', '외부 참고 수치 (인구통계 등)'],
    recommendedTools: ['주로 읽기/검색용 — 필터로 항목 빠르게 찾기'],
  },
};

interface Props {
  sheet: Sheet;
  onAddRow: () => void;
}

export default function SheetKindEmptyState({ sheet, onAddRow }: Props) {
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
                {guide.title}
              </h2>
              {meta.source === 'auto-pm' && (
                <span
                  className="text-caption px-1.5 py-0.5 rounded"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                  title="컬럼 패턴으로 자동 인식"
                >
                  자동 감지
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {guide.intro}
            </p>
          </div>
        </div>

        {/* 예시 데이터 */}
        <div>
          <div className="text-overline mb-2" style={{ color: 'var(--text-tertiary)' }}>
            이런 데이터에 어울려요
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {guide.examples.map((ex, i) => (
              <div
                key={i}
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
              >
                {ex}
              </div>
            ))}
          </div>
        </div>

        {/* 추천 도구 */}
        <div>
          <div className="text-overline mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
            <Sparkles className="w-3 h-3" />
            잘 맞는 도구
          </div>
          <ul className="space-y-1">
            {guide.recommendedTools.map((tool, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: meta.color }}>·</span>
                <span>{tool}</span>
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
            첫 행 추가
          </button>
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            시트 우클릭 → "용도 변경" 으로 종류를 바꿀 수 있어요
          </span>
        </div>
      </div>
    </div>
  );
}
