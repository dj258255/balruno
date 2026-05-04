import { useTranslations } from 'next-intl';
/**
 * AI 수식 생성 버튼 — FormulaBar 에 인라인.
 *
 * 동작:
 *  1. 버튼 클릭 → 팝오버 (textarea + 제출)
 *  2. /api/ai/formula 에 description + columns 전송
 *  3. 응답의 formula 를 부모 (FormulaBar) 에 콜백
 *  4. 에러 / 503 (API 키 부재) 은 팝오버 안에서 표시
 *
 * 이전 세션에 라우트 구현 완료된 것을 실제로 호출하는 첫 UI.
 */

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X, ArrowRight } from 'lucide-react';
import type { Column } from '@/types';

interface AiFormulaResponse {
  formula: string;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface Props {
  columns: Column[];
  currentColumn?: Column;
  onFormula: (formula: string) => void;
  disabled?: boolean;
}

export function AiFormulaButton({ columns, currentColumn, onFormula, disabled }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AiFormulaResponse | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = async () => {
    const desc = description.trim();
    if (!desc) return;
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const resp = await fetch('/api/ai/formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          columns: columns.filter((c) => c.id !== currentColumn?.id).map((c) => c.name),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(typeof data.error === 'string' ? data.error : t('sheet.aiRequestFail', { status: resp.status }));
        return;
      }
      if (typeof data.formula !== 'string') {
        setError(t('sheet.aiResponseFormatError'));
        return;
      }
      setLastResult(data as AiFormulaResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!lastResult) return;
    onFormula(lastResult.formula);
    setOpen(false);
    setDescription('');
    setLastResult(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="h-8 px-2 flex items-center gap-1 rounded-md text-xs transition-colors"
        style={{
          background: open ? 'var(--accent)' : 'var(--bg-tertiary)',
          color: open ? 'white' : 'var(--text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        title={t('sheet.aiFormulaTitle')}
        aria-label={t('sheet.aiFormulaAria')}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">AI</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg shadow-xl border overflow-hidden"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div
            className="px-3 py-2 border-b flex items-center gap-2"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('sheet.aiFormulaHeading')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto p-1 rounded hover:bg-[var(--bg-hover)]"
              aria-label={t('sheet.closeAria')}
            >
              <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>

          <div className="p-3 space-y-2">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={t('sheet.aiFormulaPlaceholder')}
              rows={3}
              className="w-full px-2 py-1.5 rounded text-xs resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              disabled={loading}
            />

            {!lastResult && (
              <div className="flex items-center justify-between">
                <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {t('sheet.cmdEnterSubmit')}
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !description.trim()}
                  className="px-2.5 py-1 rounded text-xs flex items-center gap-1"
                  style={{
                    background: loading || !description.trim() ? 'var(--bg-tertiary)' : 'var(--accent)',
                    color: loading || !description.trim() ? 'var(--text-tertiary)' : 'white',
                    cursor: loading || !description.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  {loading ? t('sheet.aiGenerating') : t('sheet.aiGenerate')}
                </button>
              </div>
            )}

            {lastResult && (
              <div
                className="p-2 rounded border space-y-1.5"
                style={{
                  background: 'var(--accent-light)',
                  borderColor: 'var(--accent)',
                }}
              >
                <div
                  className="text-caption font-mono break-all"
                  style={{ color: 'var(--text-primary)' }}
                >
                  = {lastResult.formula}
                </div>
                {lastResult.explanation && (
                  <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                    {lastResult.explanation}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  {lastResult.confidence && (
                    <span
                      className="text-caption px-1.5 py-0.5 rounded"
                      style={{
                        background:
                          lastResult.confidence === 'high'
                            ? '#10b981'
                            : lastResult.confidence === 'medium'
                              ? '#f59e0b'
                              : '#ef4444',
                        color: 'white',
                      }}
                    >
                      {lastResult.confidence}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={apply}
                    className="ml-auto px-2.5 py-1 rounded text-xs flex items-center gap-1"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {t('sheet.aiApply')}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div
                className="p-2 rounded text-caption"
                style={{
                  background: 'var(--error-light, rgba(239, 68, 68, 0.1))',
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
