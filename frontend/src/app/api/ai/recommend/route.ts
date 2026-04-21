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

/** 자유 텍스트에서 장르/난이도/규모 키워드 추출 (한국어 + 영어). */
function extractHints(description: string, context?: string): {
  genre: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'unknown';
  scale: 'small' | 'medium' | 'large';
  hasGacha: boolean;
  hasPvP: boolean;
} {
  const text = `${description} ${context ?? ''}`.toLowerCase();

  // 장르 후보 - 한/영 키워드 매핑
  const genreMap: Array<[string, string[]]> = [
    ['rpg', ['rpg', '롤플레잉', '역할', '캐릭터', 'mmorpg', 'jrpg', '메트로이드', 'metroidvania', 'soulslike', '소울라이크']],
    ['fps', ['fps', '슈팅', 'shooter', '슈터', 'tps', '배틀로얄', 'battle royale']],
    ['idle', ['idle', '방치', '클리커', 'clicker', '인크리멘탈', 'incremental']],
    ['roguelike', ['roguelike', '로그라이크', '로그라이트', 'roguelite', '하데스', 'binding of isaac']],
    ['moba', ['moba', '리그오브', 'league of', 'dota', '도타', 'aos']],
    ['strategy', ['rts', '전략', 'strategy', '시뮬레이션', '4x', 'civilization', '시드마이어']],
    ['puzzle', ['puzzle', '퍼즐', '캔디크러시', 'match-3', '3매치']],
    ['card', ['card', '카드', 'tcg', 'ccg', '하스스톤', 'hearthstone', '슬레이 더 스파이어', 'slay the spire']],
    ['platformer', ['platformer', '플랫포머', '점프', 'jump', 'mario']],
    ['sandbox', ['sandbox', '샌드박스', 'minecraft', '마인크래프트', '농장', 'farming']],
  ];
  let genre = 'rpg';
  for (const [g, kws] of genreMap) {
    if (kws.some((kw) => text.includes(kw))) {
      genre = g;
      break;
    }
  }

  // 난이도
  let difficulty: 'easy' | 'normal' | 'hard' | 'unknown' = 'unknown';
  if (/하드|hard|어려운|어렵|중상|중-상|hardcore|insane|extreme|고난도/.test(text)) difficulty = 'hard';
  else if (/이지|easy|쉬운|쉽|초보|beginner|casual/.test(text)) difficulty = 'easy';
  else if (/노멀|normal|보통|중간|중-/.test(text)) difficulty = 'normal';

  // 규모
  let scale: 'small' | 'medium' | 'large' = 'medium';
  if (/aaa|대규모|long|장기|100시간|epic|massive/.test(text)) scale = 'large';
  else if (/짧은|short|미니|mini|small|10시간 이하|5시간|인디|indie/.test(text)) scale = 'small';

  const hasGacha = /가챠|gacha|뽑기|소환|summon|루트박스|loot ?box|f2p/.test(text);
  const hasPvP = /pvp|대전|매치메이킹|랭킹|ranking|matchmaking/.test(text);

  return { genre, difficulty, scale, hasGacha, hasPvP };
}

/** 난이도/규모에 따라 ROW 개수 + sample 값 조정. */
function generateLevelSample(scale: 'small' | 'medium' | 'large'): Record<string, string | number>[] {
  const maxLevel = scale === 'small' ? 30 : scale === 'medium' ? 60 : 100;
  return Array.from({ length: Math.min(10, maxLevel) }, (_, i) => ({
    Level: i + 1,
  }));
}

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
  const hints = extractHints(body.description, body.context);
  const genre = (body.genre?.toLowerCase() ?? hints.genre);

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
          { name: 'DPS', type: 'formula', formula: '=DPS(ATK, 1.5, 0.2, 1.8)' },
        ],
      },
      {
        name: '아이템',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '카테고리', type: 'select' },
          { name: '비용', type: 'currency' },
          { name: '효과', type: 'general' },
        ],
      },
    ],
    strategy: [
      {
        name: '유닛',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '진영', type: 'select' },
          { name: '비용', type: 'currency' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: '범위', type: 'general' },
          { name: '효율', type: 'formula', formula: '=(HP * ATK) / 비용' },
        ],
      },
      {
        name: '건물',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '비용', type: 'currency' },
          { name: '건설시간', type: 'general' },
          { name: '효과', type: 'general' },
        ],
      },
    ],
    puzzle: [
      {
        name: '레벨',
        columns: [
          { name: 'Level', type: 'general' },
          { name: '목표', type: 'general' },
          { name: '제한 시간', type: 'general' },
          { name: '별 1', type: 'general' },
          { name: '별 2', type: 'general' },
          { name: '별 3', type: 'general' },
        ],
      },
    ],
    card: [
      {
        name: '카드',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '비용', type: 'general' },
          { name: '데미지', type: 'general' },
          { name: '등급', type: 'select' },
          { name: '효과', type: 'general' },
          { name: '효율', type: 'formula', formula: '=데미지 / (비용 + 1)' },
        ],
      },
      {
        name: '덱',
        columns: [
          { name: '덱이름', type: 'general' },
          { name: '카드', type: 'multiSelect' },
          { name: '평균비용', type: 'general' },
        ],
      },
    ],
    platformer: [
      {
        name: '스테이지',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '월드', type: 'select' },
          { name: '난이도', type: 'rating' },
          { name: '제한 시간', type: 'general' },
          { name: '코인 목표', type: 'general' },
        ],
      },
      {
        name: '능력',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '쿨다운', type: 'general' },
          { name: '효과', type: 'general' },
        ],
      },
    ],
    sandbox: [
      {
        name: '아이템',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: '카테고리', type: 'select' },
          { name: '레시피', type: 'general' },
          { name: '판매가', type: 'currency' },
        ],
      },
      {
        name: '몹',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '이름', type: 'general' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: '드롭', type: 'general' },
        ],
      },
    ],
  };

  let sheets = base[genre] ?? base.rpg;

  // 가챠 시트 자동 추가
  if (hints.hasGacha) {
    sheets = [
      ...sheets,
      {
        name: '가챠',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '아이템', type: 'general' },
          { name: '등급', type: 'select' },
          { name: '확률', type: 'general' },
          { name: '천장', type: 'general' },
          { name: '기댓값', type: 'formula', formula: '=GACHA_PITY(확률, 천장)' },
        ],
      },
    ];
  }

  // PvP 시트 자동 추가
  if (hints.hasPvP) {
    sheets = [
      ...sheets,
      {
        name: 'PvP 매치',
        columns: [
          { name: 'ID', type: 'general' },
          { name: '플레이어 A', type: 'general' },
          { name: '플레이어 B', type: 'general' },
          { name: '결과', type: 'select' },
          { name: '날짜', type: 'date' },
        ],
      },
      {
        name: '랭크',
        columns: [
          { name: '티어', type: 'select' },
          { name: '점수 하한', type: 'general' },
          { name: '점수 상한', type: 'general' },
          { name: '인구 비율', type: 'general' },
        ],
      },
    ];
  }

  // RPG/평형 장르에는 레벨 sample row 채우기
  if (genre === 'rpg') {
    const sample = generateLevelSample(hints.scale);
    sheets = sheets.map((s) =>
      s.name === '레벨테이블' ? { ...s, sampleRows: sample } : s
    );
  }

  const detectedHints = [
    `장르=${genre}`,
    hints.difficulty !== 'unknown' && `난이도=${hints.difficulty}`,
    `규모=${hints.scale}`,
    hints.hasGacha && '가챠↑',
    hints.hasPvP && 'PvP↑',
  ].filter(Boolean).join(' · ');

  return {
    sheets,
    note: `템플릿 기반 추천 (${detectedHints}). 요구사항: "${body.description.slice(0, 80)}".`,
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

  // LLM 호출은 백엔드 서버에서 처리 — 프론트는 항상 템플릿 fallback.
  // ANTHROPIC_API_KEY 가 있어도 사용하지 않음 (보안 + 책임 분리).
  return NextResponse.json(templateFallback(body));
}
