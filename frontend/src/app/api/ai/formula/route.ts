/**
 * Track 11 MVP — NL → formula 엔드포인트 스캐폴딩.
 *
 * 실제 LLM 호출은 환경변수 `ANTHROPIC_API_KEY` 가 있을 때만 작동.
 * 없으면 503 Service Unavailable. 5단계 validator 파이프라인은 다음 세션.
 *
 * 사용 예 (클라이언트):
 *   fetch('/api/ai/formula', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       description: '공격력 + 방어력의 50%',
 *       columns: ['ATK', 'DEF'],
 *     })
 *   })
 *
 * 응답 스키마:
 *   { formula: string, confidence?: number } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';

interface FormulaRequest {
  description: string;
  columns?: string[];
  /** 선택: 현재 컬럼 context (타입, 예제 값) */
  context?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'AI 기능 비활성 상태. ANTHROPIC_API_KEY 환경변수 설정 필요.',
        stage: 'config',
      },
      { status: 503 }
    );
  }

  let body: FormulaRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'description 필수' }, { status: 400 });
  }

  // MVP: 실제 Anthropic SDK 호출 자리. 다음 세션에 5단계 validator 추가.
  // 1. LLM 호출 (스키마 주입: availableFunctions + 현재 컬럼)
  // 2. validateFormula (문법)
  // 3. extractColumnReferences (컬럼 존재 검증)
  // 4. Sandbox dry-run
  // 5. 유저 확인 UI
  return NextResponse.json(
    {
      error: 'Track 11 MVP — 실제 LLM 호출은 다음 세션에 구현됩니다.',
      stage: 'not-implemented',
      receivedDescription: body.description,
      receivedColumns: body.columns ?? [],
    },
    { status: 501 }
  );
}
