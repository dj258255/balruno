/**
 * miniMarkdown — longText 컬럼 전용 초경량 마크다운 렌더러.
 *
 * 외부 의존성 없음 (react-markdown / marked 미설치). 지원 문법은 딱 3가지:
 *   - `#`, `##`, `###`  heading (h1~h3)
 *   - `**bold**`         인라인 볼드
 *   - `- ` 또는 `* `     bullet 리스트
 *
 * 그 외 줄은 문단(<p>)으로 렌더. 순수 함수 — parse(AST) 와 render(React)
 * 를 분리해 테스트 가능하게 유지한다. 값은 항상 plain 문자열 (op-log 그대로).
 */
import React from 'react';

export type MiniMdInline =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string };

export type MiniMdBlock =
  | { type: 'heading'; level: 1 | 2 | 3; children: MiniMdInline[] }
  | { type: 'bullets'; items: MiniMdInline[][] }
  | { type: 'paragraph'; children: MiniMdInline[] };

/** 한 줄 안의 `**bold**` 구간을 인라인 노드 배열로 분해. */
export function parseInline(text: string): MiniMdInline[] {
  const parts: MiniMdInline[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
    }
    parts.push({ type: 'bold', value: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: 'text', value: '' });
  }
  return parts;
}

/** 원본 문자열 → 블록 AST. 순수 함수 (React 무관, 테스트 용이). */
export function parseMiniMarkdown(src: string): MiniMdBlock[] {
  const lines = src.split(/\r?\n/);
  const blocks: MiniMdBlock[] = [];
  let bullets: MiniMdInline[][] | null = null;

  const flushBullets = () => {
    if (bullets) {
      blocks.push({ type: 'bullets', items: bullets });
      bullets = null;
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);

    if (heading) {
      flushBullets();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
    } else if (bullet) {
      if (!bullets) bullets = [];
      bullets.push(parseInline(bullet[1]));
    } else if (line.trim() === '') {
      // 빈 줄은 문단 구분자 — 리스트를 닫고 스킵.
      flushBullets();
    } else {
      flushBullets();
      blocks.push({ type: 'paragraph', children: parseInline(line) });
    }
  }
  flushBullets();
  return blocks;
}

function renderInline(parts: MiniMdInline[], keyPrefix: string): React.ReactNode[] {
  return parts.map((p, i) =>
    p.type === 'bold' ? (
      <strong key={`${keyPrefix}-${i}`}>{p.value}</strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{p.value}</React.Fragment>
    ),
  );
}

/** AST → React 엘리먼트. longText 값을 펼쳐 보여줄 표면에서 사용. */
export function renderMiniMarkdown(src: string): React.ReactElement {
  const blocks = parseMiniMarkdown(src);
  return (
    <div className="mini-md">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const Tag = `h${b.level}` as 'h1' | 'h2' | 'h3';
          return <Tag key={i}>{renderInline(b.children, `h${i}`)}</Tag>;
        }
        if (b.type === 'bullets') {
          return (
            <ul key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item, `b${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(b.children, `p${i}`)}</p>;
      })}
    </div>
  );
}

/** 편의 컴포넌트 래퍼. */
export function MiniMarkdown({ source }: { source: string }): React.ReactElement {
  return renderMiniMarkdown(source);
}
