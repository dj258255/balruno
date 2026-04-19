/**
 * Track 11 MVP — 자연어 요구사항 → 초기 밸런스 시트 추천.
 *
 * 입력 예: "메트로이드바니아 + 난이도 중상 + 20시간 + 스킬 30개"
 * 출력: 시트 구조 배열 (이름 / 컬럼 / 초기 행)
 *
 * 단계:
 *   1. LLM 호출 (ANTHROPIC_API_KEY 필요) — 요구사항 → JSON 스키마
 *   2. 기본 템플릿 매칭 (fallback, 키 없어도 동작)
 *   3. validateFormula + extractColumnReferences (다음 세션)
 */

import { NextRequest, NextResponse } from 'next/server';

interface RecommendRequest {
  description: string;
  /** 워크타입 — 밸런싱 / 팀 PM / 기획 문서 */
  workType?: 'balancing' | 'pm' | 'design-doc';
  /** workType='balancing' 일 때의 장르 */
  genre?: string; // 'rpg' | 'fps' | 'moba' | 'idle' | 'roguelike'
  /** 선택: 플레이 시간, 타겟 플랫폼, 난이도 등 자유 텍스트 */
  context?: string;
}

interface RecommendedColumn {
  name: string;
  type: string; // ColumnType
  formula?: string;
}

interface RecommendedSheet {
  name: string;
  columns: RecommendedColumn[];
  sampleRows?: Record<string, string | number>[];
}

interface RecommendResponse {
  sheets: RecommendedSheet[];
  note: string;
  mode: 'llm' | 'template-fallback';
}

/** 팀 PM 워크타입용 기본 템플릿 (Sprint + Bug + Roadmap). */
const PM_TEMPLATE: RecommendedSheet[] = [
  {
    name: 'Sprint Board',
    columns: [
      { name: 'ID', type: 'general' },
      { name: 'Title', type: 'general' },
      { name: 'Status', type: 'select' },
      { name: 'Priority', type: 'select' },
      { name: 'Role', type: 'select' },
      { name: 'Assignee', type: 'general' },
      { name: 'Points', type: 'general' },
      { name: 'Due', type: 'date' },
    ],
  },
  {
    name: 'Bugs',
    columns: [
      { name: 'ID', type: 'general' },
      { name: 'Title', type: 'general' },
      { name: 'Severity', type: 'select' },
      { name: 'Status', type: 'select' },
      { name: 'Platform', type: 'multiSelect' },
      { name: 'Reporter', type: 'general' },
      { name: 'Assignee', type: 'general' },
      { name: 'Created', type: 'date' },
    ],
  },
  {
    name: 'Epic Roadmap',
    columns: [
      { name: 'ID', type: 'general' },
      { name: 'Epic', type: 'general' },
      { name: 'Phase', type: 'select' },
      { name: 'Start', type: 'date' },
      { name: 'End', type: 'date' },
      { name: 'Owner', type: 'general' },
    ],
  },
];

const DESIGN_DOC_TEMPLATE: RecommendedSheet[] = [
  {
    name: '기획 문서',
    columns: [
      { name: '섹션', type: 'general' },
      { name: '내용', type: 'general' },
      { name: '담당', type: 'general' },
      { name: '상태', type: 'select' },
      { name: '리뷰 마감', type: 'date' },
    ],
  },
];

/** 템플릿 기반 fallback — LLM 없이도 동작. */
function templateFallback(body: RecommendRequest): RecommendResponse {
  const workType = body.workType ?? 'balancing';

  if (workType === 'pm') {
    return {
      sheets: PM_TEMPLATE,
      note: `팀 PM 템플릿 (스프린트 + 버그 + 로드맵). 요구사항: "${body.description.slice(0, 80)}".`,
      mode: 'template-fallback',
    };
  }

  if (workType === 'design-doc') {
    return {
      sheets: DESIGN_DOC_TEMPLATE,
      note: `기획 문서 템플릿 (베타). 요구사항: "${body.description.slice(0, 80)}".`,
      mode: 'template-fallback',
    };
  }

  // workType === 'balancing'
  const genre = body.genre?.toLowerCase() ?? 'rpg';

  const base: Record<string, RecommendedSheet[]> = {
    rpg: [
      {
        name: '캐릭터',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '직업', type: 'select' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: 'DEF', type: 'general' },
          { name: 'DPS', type: 'formula', formula: '=DPS(ATK, 1, 0.3, 2)' },
          { name: 'EHP', type: 'formula', formula: '=EHP(HP, DEF)' },
        ],
      },
      {
        name: '레벨테이블',
        columns: [
          { name: 'Level', type: 'general' },
          { name: '경험치', type: 'formula', formula: '=SCALE(100, Level, 1.2, "exponential")' },
          { name: 'HP', type: 'formula', formula: '=SCALE(100, Level, 1.1, "exponential")' },
        ],
      },
      {
        name: '스킬',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '데미지', type: 'general' },
          { name: '쿨다운', type: 'general' },
          { name: '타입', type: 'select' },
        ],
      },
    ],
    fps: [
      {
        name: '무기',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '카테고리', type: 'select' },
          { name: '데미지', type: 'general' },
          { name: 'RPM', type: 'general' },
          { name: 'DPS', type: 'formula', formula: '=DPS(데미지, RPM/60, 0, 1)' },
          { name: 'TTK', type: 'formula', formula: '=TTK(100, 데미지, RPM/60)' },
        ],
      },
    ],
    idle: [
      {
        name: '업그레이드',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '기본비용', type: 'general' },
          { name: '비용증가율', type: 'general' },
          { name: '효과', type: 'general' },
          { name: 'ROI', type: 'formula', formula: '=효과 / 기본비용' },
        ],
      },
    ],
    roguelike: [
      {
        name: '유물',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '등급', type: 'select' },
          { name: '효과', type: 'general' },
          { name: '드롭률', type: 'general' },
          { name: '티어지수', type: 'formula', formula: '=TIER_INDEX(등급)' },
        ],
      },
    ],
    moba: [
      {
        name: '챔피언',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '역할', type: 'select' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: '이속', type: 'general' },
        ],
      },
    ],
  };

  const sheets = base[genre] ?? base.rpg;
  return {
    sheets,
    note: `장르 템플릿 기반 fallback (genre="${genre}"). 요구사항: "${body.description.slice(0, 80)}". LLM 통합 시 더 정밀한 제안 가능.`,
    mode: 'template-fallback',
  };
}

export async function POST(req: NextRequest) {
  let body: RecommendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'description 필수' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // LLM 미설정 시 템플릿 fallback
  if (!apiKey) {
    return NextResponse.json(templateFallback(body));
  }

  // LLM 호출 (다음 세션에서 실제 Anthropic SDK 통합)
  // - 프롬프트: "다음 요구사항에 맞는 게임 밸런스 시트 3-5개 JSON 으로..."
  // - 현재는 stub (template fallback)
  const response = templateFallback(body);
  response.mode = 'template-fallback'; // LLM 통합 전까지 유지
  response.note += ' [LLM endpoint 스캐폴딩 상태 — 실제 호출은 다음 세션]';
  return NextResponse.json(response);
}
