/**
 * 자연어 요구사항 → 초기 밸런스 시트 추천.
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
import { getServerT } from '@/lib/serverI18n';

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

function buildDesignDocTemplate(t: (k: string, v?: Record<string, string | number>) => string): RecommendedSheet[] {
  return [
    {
      name: t('designDocSheet'),
      columns: [
        { name: t('designDocSection'), type: 'general' },
        { name: t('designDocContent'), type: 'general' },
        { name: t('designDocOwner'), type: 'general' },
        { name: t('designDocStatus'), type: 'select' },
        { name: t('designDocReview'), type: 'date' },
      ],
    },
  ];
}

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
function templateFallback(body: RecommendRequest, t: (k: string, v?: Record<string, string | number>) => string): RecommendResponse {
  const workType = body.workType ?? 'balancing';
  const desc = body.description.slice(0, 80);

  if (workType === 'pm') {
    return {
      sheets: PM_TEMPLATE,
      note: t('notePm', { desc }),
      mode: 'template-fallback',
    };
  }

  if (workType === 'design-doc') {
    return {
      sheets: buildDesignDocTemplate(t),
      note: t('noteDesignDoc', { desc }),
      mode: 'template-fallback',
    };
  }

  const hints = extractHints(body.description, body.context);
  const genre = (body.genre?.toLowerCase() ?? hints.genre);

  const N = (k: string) => t(k);
  const NAME = N('tmplName');
  const DAMAGE = N('tmplDamage');
  const COST = N('tmplCost');
  const EFFECT = N('tmplEffect');
  const GRADE = N('tmplGrade');
  const PROB = N('tmplProb');
  const PITY = N('tmplPity');

  const base: Record<string, RecommendedSheet[]> = {
    rpg: [
      {
        name: N('tmplCharacter'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplClass'), type: 'select' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: 'DEF', type: 'general' },
          { name: 'DPS', type: 'formula', formula: '=DPS(ATK, 1, 0.3, 2)' },
          { name: 'EHP', type: 'formula', formula: '=EHP(HP, DEF)' },
        ],
      },
      {
        name: N('tmplLevelTable'),
        columns: [
          { name: 'Level', type: 'general' },
          { name: N('tmplExp'), type: 'formula', formula: '=SCALE(100, Level, 1.2, "exponential")' },
          { name: 'HP', type: 'formula', formula: '=SCALE(100, Level, 1.1, "exponential")' },
        ],
      },
      {
        name: N('tmplSkill'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: DAMAGE, type: 'general' },
          { name: N('tmplCooldown'), type: 'general' },
          { name: N('tmplType'), type: 'select' },
        ],
      },
    ],
    fps: [
      {
        name: N('tmplWeapon'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplCategory'), type: 'select' },
          { name: DAMAGE, type: 'general' },
          { name: 'RPM', type: 'general' },
          { name: 'DPS', type: 'formula', formula: `=DPS(${DAMAGE}, RPM/60, 0, 1)` },
          { name: 'TTK', type: 'formula', formula: `=TTK(100, ${DAMAGE}, RPM/60)` },
        ],
      },
    ],
    idle: [
      {
        name: N('tmplUpgrade'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplBaseCost'), type: 'general' },
          { name: N('tmplCostGrowth'), type: 'general' },
          { name: EFFECT, type: 'general' },
          { name: 'ROI', type: 'formula', formula: `=${EFFECT} / ${N('tmplBaseCost')}` },
        ],
      },
    ],
    roguelike: [
      {
        name: N('tmplArtifact'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: GRADE, type: 'select' },
          { name: EFFECT, type: 'general' },
          { name: N('tmplDropRate'), type: 'general' },
          { name: N('tmplTierIndex'), type: 'formula', formula: `=TIER_INDEX(${GRADE})` },
        ],
      },
    ],
    moba: [
      {
        name: N('tmplChampion'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplRole'), type: 'select' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: N('tmplMs'), type: 'general' },
          { name: 'DPS', type: 'formula', formula: '=DPS(ATK, 1.5, 0.2, 1.8)' },
        ],
      },
      {
        name: N('tmplItem'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplCategory'), type: 'select' },
          { name: COST, type: 'currency' },
          { name: EFFECT, type: 'general' },
        ],
      },
    ],
    strategy: [
      {
        name: N('tmplUnit'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplFaction'), type: 'select' },
          { name: COST, type: 'currency' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: N('tmplRange'), type: 'general' },
          { name: N('tmplEfficiency'), type: 'formula', formula: `=(HP * ATK) / ${COST}` },
        ],
      },
      {
        name: N('tmplBuilding'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: COST, type: 'currency' },
          { name: N('tmplBuildTime'), type: 'general' },
          { name: EFFECT, type: 'general' },
        ],
      },
    ],
    puzzle: [
      {
        name: N('tmplLevel'),
        columns: [
          { name: 'Level', type: 'general' },
          { name: N('tmplGoal'), type: 'general' },
          { name: N('tmplTimeLimit'), type: 'general' },
          { name: N('tmplStar1'), type: 'general' },
          { name: N('tmplStar2'), type: 'general' },
          { name: N('tmplStar3'), type: 'general' },
        ],
      },
    ],
    card: [
      {
        name: N('tmplCard'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: COST, type: 'general' },
          { name: DAMAGE, type: 'general' },
          { name: GRADE, type: 'select' },
          { name: EFFECT, type: 'general' },
          { name: N('tmplEfficiency'), type: 'formula', formula: `=${DAMAGE} / (${COST} + 1)` },
        ],
      },
      {
        name: N('tmplDeck'),
        columns: [
          { name: N('tmplDeckName'), type: 'general' },
          { name: N('tmplCard'), type: 'multiSelect' },
          { name: N('tmplAvgCost'), type: 'general' },
        ],
      },
    ],
    platformer: [
      {
        name: N('tmplStage'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplWorld'), type: 'select' },
          { name: N('tmplDifficulty'), type: 'rating' },
          { name: N('tmplTimeLimit'), type: 'general' },
          { name: N('tmplCoinGoal'), type: 'general' },
        ],
      },
      {
        name: N('tmplAbility'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplCooldown'), type: 'general' },
          { name: EFFECT, type: 'general' },
        ],
      },
    ],
    sandbox: [
      {
        name: N('tmplItem'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: N('tmplCategory'), type: 'select' },
          { name: N('tmplRecipe'), type: 'general' },
          { name: N('tmplSellPrice'), type: 'currency' },
        ],
      },
      {
        name: N('tmplMob'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: NAME, type: 'general' },
          { name: 'HP', type: 'general' },
          { name: 'ATK', type: 'general' },
          { name: N('tmplDrop'), type: 'general' },
        ],
      },
    ],
  };

  let sheets = base[genre] ?? base.rpg;

  if (hints.hasGacha) {
    sheets = [
      ...sheets,
      {
        name: N('tmplGacha'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: N('tmplItem'), type: 'general' },
          { name: GRADE, type: 'select' },
          { name: PROB, type: 'general' },
          { name: PITY, type: 'general' },
          { name: N('tmplExpected'), type: 'formula', formula: `=GACHA_PITY(${PROB}, ${PITY})` },
        ],
      },
    ];
  }

  if (hints.hasPvP) {
    sheets = [
      ...sheets,
      {
        name: N('tmplPvpMatch'),
        columns: [
          { name: 'ID', type: 'general' },
          { name: N('tmplPlayerA'), type: 'general' },
          { name: N('tmplPlayerB'), type: 'general' },
          { name: N('tmplResult'), type: 'select' },
          { name: N('tmplDate'), type: 'date' },
        ],
      },
      {
        name: N('tmplRank'),
        columns: [
          { name: N('tmplTier'), type: 'select' },
          { name: N('tmplScoreLow'), type: 'general' },
          { name: N('tmplScoreHigh'), type: 'general' },
          { name: N('tmplPopulation'), type: 'general' },
        ],
      },
    ];
  }

  const levelTableName = N('tmplLevelTable');
  if (genre === 'rpg') {
    const sample = generateLevelSample(hints.scale);
    sheets = sheets.map((s) =>
      s.name === levelTableName ? { ...s, sampleRows: sample } : s
    );
  }

  const detectedHints = [
    t('hintGenre', { genre }),
    hints.difficulty !== 'unknown' && t('hintDifficulty', { difficulty: hints.difficulty }),
    t('hintScale', { scale: hints.scale }),
    hints.hasGacha && t('hintGacha'),
    hints.hasPvP && t('hintPvp'),
  ].filter(Boolean).join(' · ');

  return {
    sheets,
    note: t('noteTemplate', { hints: detectedHints, desc }),
    mode: 'template-fallback',
  };
}

export async function POST(req: NextRequest) {
  const t = await getServerT(req, 'aiApi');
  let body: RecommendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t('parseFailed') }, { status: 400 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: t('descRequired') }, { status: 400 });
  }

  // LLM 호출은 백엔드 서버에서 처리 — 프론트는 항상 템플릿 fallback.
  // ANTHROPIC_API_KEY 가 있어도 사용하지 않음 (보안 + 책임 분리).
  return NextResponse.json(templateFallback(body, t));
}
