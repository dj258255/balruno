/**
 * AI Copilot chat 엔드포인트 — M3-3.
 *
 * 입력: { messages: [...], context: string }
 * 출력: SSE 스트리밍 (text/event-stream)
 *
 * ANTHROPIC_API_KEY 없으면 fallback 메시지 반환.
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerT } from '@/lib/serverI18n';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context: string;         // buildAIContext().summary
  systemPrompt: string;    // AI_SYSTEM_PROMPT
}

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const t = await getServerT(req, 'aiApi');

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: t('invalidJson') }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!apiKey) {
    const fallback = t('chatFallback', {
      context: body.context.slice(0, 2000),
      question: body.messages[body.messages.length - 1]?.content ?? '',
    });
    return new Response(fallback, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemContent = [
      body.systemPrompt,
      '',
      t('chatProjectContext'),
      '',
      body.context,
    ].join('\n');

    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemContent,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // SSE 스트리밍
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(t('streamError', { msg: err instanceof Error ? err.message : String(err) }))
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
