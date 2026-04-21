'use client';

/**
 * AI Copilot Panel — M3-1.
 *
 * 우측 플로팅 패널. 유저 질문 → 프로젝트 전체 컨텍스트와 함께 Claude API 호출.
 * 스트리밍 응답 렌더.
 *
 * 컨텍스트 = buildAIContext(project) — 시트 · 문서 · changelog · 활성 태스크.
 * 시스템 프롬프트 = AI_SYSTEM_PROMPT (게임 밸런스 도메인).
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, Send, X, Loader2, Sparkles, FileText, Database, History } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { buildAIContext, AI_SYSTEM_PROMPT } from '@/lib/aiContext';

interface Props {
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  '전사 HP 가 왜 이렇게 설정됐어?',
  '현재 밸런스에서 가장 큰 이상치는?',
  '이번 주 변경 사항 요약해줘',
  '다음 패치에서 뭘 조정하면 좋을까?',
];

export default function AICopilotPanel({ onClose }: Props) {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === currentProjectId));

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => buildAIContext(project), [project]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages([...updated, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          context: context.summary,
          systemPrompt: AI_SYSTEM_PROMPT,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.text();
        setMessages((msgs) => {
          const next = [...msgs];
          next[next.length - 1] = { role: 'assistant', content: `오류: ${err}` };
          return next;
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setMessages((msgs) => {
          const next = [...msgs];
          next[next.length - 1] = { role: 'assistant', content: buf };
          return next;
        });
      }
    } catch (err) {
      setMessages((msgs) => {
        const next = [...msgs];
        next[next.length - 1] = {
          role: 'assistant',
          content: `오류: ${err instanceof Error ? err.message : String(err)}`,
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] max-w-full border-l flex flex-col z-50 shadow-2xl"
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      role="complementary"
      aria-label="AI Copilot"
    >
      {/* 헤더 */}
      <header
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
        >
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI Copilot
          </h2>
          <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            프로젝트 컨텍스트 · 약 {context.tokensEstimate.toLocaleString()} 토큰
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
          aria-label="닫기"
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </header>

      {/* 컨텍스트 요약 */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b text-caption"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
      >
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {context.sources.sheets} 시트
        </div>
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {context.sources.docs} 문서
        </div>
        <div className="flex items-center gap-1">
          <History className="w-3 h-3" />
          {context.sources.changelog} 변경
        </div>
      </div>

      {/* 메시지 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="text-center py-4 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto opacity-50" style={{ color: '#8b5cf6' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                프로젝트 전체를 분석해 답변합니다
              </p>
              <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                수식 · changelog · 문서 · 태스크 교차 참조
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-overline px-1" style={{ color: 'var(--text-tertiary)' }}>
                추천 질문
              </div>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:shadow-sm transition-all"
                  style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
                style={{
                  background: m.role === 'user' ? '#8b5cf6' : 'var(--bg-primary)',
                  color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                  border: m.role === 'assistant' ? '1px solid var(--border-primary)' : 'none',
                  borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                  borderBottomLeftRadius: m.role === 'assistant' ? 4 : undefined,
                }}
              >
                {m.content || (isStreaming && i === messages.length - 1 ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 입력 */}
      <div
        className="p-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex items-end gap-2 p-2 rounded-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="프로젝트에 대해 무엇이든 물어보세요"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm py-1"
            style={{ color: 'var(--text-primary)', maxHeight: 120 }}
            disabled={isStreaming}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="p-1.5 rounded-lg disabled:opacity-40 transition-colors"
            style={{ background: '#8b5cf6', color: 'white' }}
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
