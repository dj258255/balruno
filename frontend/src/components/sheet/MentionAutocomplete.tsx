'use client';

/**
 * @mention autocomplete — 코멘트/답글 textarea 옆 dropdown.
 *
 * 동작:
 *  1. textarea value / caret 을 받음 → getMentionContext 로 @prefix 감지
 *  2. candidates 중 prefix 필터링 → dropdown 표시
 *  3. ↑/↓ 로 active 이동, Enter/Tab 로 삽입, Esc 로 닫기
 *  4. 마우스 클릭 삽입도 지원
 *
 * Figma/Notion/Slack 의 @mention 드롭다운 패턴 재현.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AtSign } from 'lucide-react';
import { getMentionContext } from '@/lib/cellComments';

export interface MentionCandidate {
  name: string;
  color: string;
}

interface Props {
  value: string;
  caret: number;
  candidates: MentionCandidate[];
  /** 자동완성 선택 시 새 텍스트 + 새 caret 위치 */
  onInsert: (newText: string, newCaret: number) => void;
  /** 외부에서 ↑/↓/Enter/Escape 받으려면 이 핸들러 호출. 반환 true 면 키 consume */
  onKeyDownRef?: React.MutableRefObject<((e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean) | null>;
}

export default function MentionAutocomplete({
  value,
  caret,
  candidates,
  onInsert,
  onKeyDownRef,
}: Props) {
  const context = getMentionContext(value, caret);
  const prefix = context?.prefix ?? null;

  const filtered = useMemo(() => {
    if (prefix === null) return [];
    const p = prefix.toLowerCase();
    return candidates.filter((c) => c.name.toLowerCase().startsWith(p));
  }, [prefix, candidates]);

  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { setActiveIdx(0); }, [prefix, filtered.length]);

  const insert = useCallback((name: string) => {
    if (!context) return;
    const before = value.slice(0, context.start);
    const after = value.slice(caret);
    // 뒤에 공백 없으면 자동으로 하나 붙여줌
    const needSpace = after.length === 0 || !/^\s/.test(after);
    const replacement = `@${name}${needSpace ? ' ' : ''}`;
    const newText = before + replacement + after;
    const newCaret = before.length + replacement.length;
    onInsert(newText, newCaret);
  }, [context, value, caret, onInsert]);

  // 부모 textarea 의 keydown 에서 이 핸들러 호출하도록 ref 에 주입
  useEffect(() => {
    if (!onKeyDownRef) return;
    onKeyDownRef.current = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (prefix === null || filtered.length === 0) return false;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insert(filtered[activeIdx].name);
        return true;
      }
      if (e.key === 'Escape') {
        // prefix 는 있지만 닫고 싶음 — 간단히 공백 삽입해서 컨텍스트 깨기
        e.preventDefault();
        const before = value.slice(0, caret);
        const after = value.slice(caret);
        onInsert(before + ' ' + after, caret + 1);
        return true;
      }
      return false;
    };
    return () => {
      if (onKeyDownRef) onKeyDownRef.current = null;
    };
  }, [prefix, filtered, activeIdx, insert, onKeyDownRef, value, caret, onInsert]);

  if (prefix === null || filtered.length === 0) return null;

  return (
    <div
      className="absolute left-0 bottom-full mb-1 w-56 rounded border shadow-lg z-40"
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
    >
      <div className="flex items-center gap-1 px-2 py-1 text-caption border-b" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
        <AtSign size={10} />
        <span>멘션 {prefix ? `(${prefix})` : ''}</span>
        <span className="ml-auto">↑↓ Enter</span>
      </div>
      {filtered.map((c, i) => (
        <button
          key={c.name}
          onMouseDown={(e) => { e.preventDefault(); insert(c.name); }}
          onMouseEnter={() => setActiveIdx(i)}
          className="w-full flex items-center gap-2 px-2 py-1 text-caption text-left"
          style={{
            background: i === activeIdx ? 'var(--bg-tertiary)' : 'transparent',
            color: 'var(--text-primary)',
          }}
        >
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-caption font-bold text-white shrink-0"
            style={{ background: c.color }}
          >
            {c.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * TextAreaWithMentions — textarea + autocomplete 쌍 일체화 convenience wrapper.
 * CommentsPanel 의 3군데 (new / reply / edit) 모두 재사용 가능.
 */
export function TextAreaWithMentions({
  value,
  onChange,
  candidates,
  placeholder,
  rows = 2,
  onSubmit,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  candidates: MentionCandidate[];
  placeholder?: string;
  rows?: number;
  /** ⌘/Ctrl + Enter 콜백 */
  onSubmit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const autocompleteKeyHandler = useRef<((e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean) | null>(null);

  return (
    <div className="relative flex-1">
      <MentionAutocomplete
        value={value}
        caret={caret}
        candidates={candidates}
        onInsert={(newText, newCaret) => {
          onChange(newText);
          // caret 업데이트는 textarea 에 다시 focus 한 뒤
          requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
              el.focus();
              el.setSelectionRange(newCaret, newCaret);
              setCaret(newCaret);
            }
          });
        }}
        onKeyDownRef={autocompleteKeyHandler}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          // autocomplete 가 consume 하면 통과
          if (autocompleteKeyHandler.current?.(e)) return;
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        placeholder={placeholder}
        rows={rows}
        className={className ?? 'w-full px-2 py-1 text-xs rounded border bg-transparent resize-none'}
        style={style ?? { borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}
