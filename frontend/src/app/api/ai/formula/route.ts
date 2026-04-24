/**
 * NL → formula 엔드포인트.
 *
 * 입력: { description, columns, context? }
 * 출력: { formula, explanation?, confidence? } | { error, stage }
 *
 * 기능:
 *  - ANTHROPIC_API_KEY 있으면 실제 LLM 호출 (Claude opus-4-7)
 *  - 없으면 503 + 친절한 에러
 *  - 응답에서 formula 문자열만 추출 (코드 펜스 / 접두어 제거)
 *  - 사용 가능 함수 목록을 system 에 주입 (게임 함수 + Excel 300+ 핵심)
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

interface FormulaRequest {
  description: string;
  columns?: string[];
  /** 선택: 현재 컬럼 context (타입, 예제 값) */
  context?: Record<string, unknown>;
}

interface FormulaResponse {
  formula: string;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
}

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 512;

const GAME_FUNCTIONS = [
  'DAMAGE(atk, def)', 'DPS(atk, attackSpeed)', 'EHP(hp, def, dodge)',
  'SCALE(base, level, step, curve)', 'TTK(hp, dps)', 'CRIT_DMG(base, rate, mult)',
  'DIMINISHING(stacks, per, cap)', 'ELEMENT_MULT(attacker, defender)',
  'STAMINA_REGEN(max, rate, time)', 'COMBO_MULT(hits, perHit)',
  'STAR_RATING(tier, sub)', 'TIER_INDEX(tier)',
  'LTV(arpdau, retention)', 'ARPU(revenue, users)', 'K_FACTOR(invites, conversion)',
];
const EXCEL_FUNCTIONS = [
  'IF(cond, a, b)', 'SUMIF(range, criteria)', 'COUNTIF(range, criteria)',
  'VLOOKUP(key, table, col, exact)', 'LEFT(str, n)', 'RIGHT(str, n)', 'MID(str, start, n)',
  'LEN(str)', 'UPPER(str)', 'LOWER(str)', 'CONCATENATE(...)',
  'DATE(y, m, d)', 'TODAY()', 'ROUND(n, d)', 'POWER(n, p)',
  'MIN(...)', 'MAX(...)', 'SUM(...)', 'AVERAGE(...)',
];

function buildSystemPrompt(columns: string[]): string {
  return [
    '당신은 게임 밸런싱 스프레드시트의 수식 작성 전문가입니다.',
    '사용자가 자연어로 설명한 계산 의도를 단일 수식으로 변환하세요.',
    '',
    '## 출력 규칙 (엄격)',
    '1. JSON 만 반환. 다른 텍스트 절대 금지.',
    '2. 스키마: { "formula": string, "explanation": string, "confidence": "high" | "medium" | "low" }',
    '3. formula 는 등호(=) 없이 순수 표현식. 예: `ATK * 2 - DEF / 3` (O), `=ATK*2` (X)',
    '4. 컬럼 참조는 아래 컬럼명 목록의 이름을 그대로 사용 (대소문자 · 한영 포함).',
    '5. 존재하지 않는 컬럼을 지어내지 말 것. 모호하면 confidence="low".',
    '6. explanation 은 1~2 문장, 한국어.',
    '',
    '## 사용 가능 컬럼',
    columns.length > 0 ? columns.map((c) => `- ${c}`).join('\n') : '(컬럼 정보 없음)',
    '',
    '## 사용 가능 게임 함수',
    GAME_FUNCTIONS.map((f) => `- ${f}`).join('\n'),
    '',
    '## 사용 가능 Excel 함수 (일부)',
    EXCEL_FUNCTIONS.map((f) => `- ${f}`).join('\n'),
    '',
    '## 예시',
    '질문: "공격력에서 방어력의 50% 를 뺀 값"',
    '답: {"formula": "ATK - DEF * 0.5", "explanation": "공격력에서 방어력 절반을 차감합니다.", "confidence": "high"}',
  ].join('\n');
}

function extractJson(text: string): unknown | null {
  // 코드 펜스 제거
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  // 첫 { 부터 마지막 } 까지만
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const sliced = stripped.slice(first, last + 1);
  try {
    return JSON.parse(sliced);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'AI 기능 비활성 상태. 서버에 ANTHROPIC_API_KEY 환경변수를 설정하세요.',
        stage: 'config',
      },
      { status: 503 }
    );
  }

  let body: FormulaRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패', stage: 'parse' }, { status: 400 });
  }

  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json(
      { error: 'description 필수', stage: 'validate' },
      { status: 400 }
    );
  }

  const columns = Array.isArray(body.columns) ? body.columns.filter((c) => typeof c === 'string') : [];

  try {
    const client = new Anthropic({ apiKey });
    const system = buildSystemPrompt(columns);

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: description,
        },
      ],
    });

    // 응답에서 첫 text block 추출
    const textBlock = message.content.find((c) => c.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    const parsed = extractJson(raw) as Partial<FormulaResponse> | null;
    if (!parsed || typeof parsed.formula !== 'string') {
      return NextResponse.json(
        {
          error: 'LLM 응답 파싱 실패 — JSON 스키마 미준수',
          stage: 'parse-llm',
          raw: raw.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const response: FormulaResponse = {
      formula: parsed.formula.replace(/^=\s*/, '').trim(),
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : undefined,
      confidence:
        parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
          ? parsed.confidence
          : undefined,
    };

    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `LLM 호출 실패: ${msg}`, stage: 'llm' },
      { status: 502 }
    );
  }
}
