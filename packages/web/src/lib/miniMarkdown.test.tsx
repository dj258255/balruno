/**
 * miniMarkdown — 초경량 마크다운 파서/렌더러 단위 테스트.
 *
 * 지원 문법(heading / bold / bullet) 만 정확히 처리하고, 미지원 문법은
 * 평문으로 흘려보내는지 검증. AST 는 순수 함수로, 렌더는 정적 HTML 로 확인.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  parseInline,
  parseMiniMarkdown,
  renderMiniMarkdown,
} from './miniMarkdown';

describe('parseInline — bold 분해', () => {
  it('평문은 단일 text 노드', () => {
    expect(parseInline('hello world')).toEqual([
      { type: 'text', value: 'hello world' },
    ]);
  });

  it('**bold** 를 bold 노드로 분리', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('여러 bold 를 모두 잡는다', () => {
    const parts = parseInline('**x** and **y**');
    expect(parts.filter((p) => p.type === 'bold')).toHaveLength(2);
  });
});

describe('parseMiniMarkdown — 블록 AST', () => {
  it('#/##/### 는 heading level 1~3', () => {
    const blocks = parseMiniMarkdown('# H1\n## H2\n### H3');
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.type === 'heading' && b.level)).toEqual([1, 2, 3]);
  });

  it('#### 는 heading 이 아니라 문단으로 처리 (level 3 초과)', () => {
    const blocks = parseMiniMarkdown('#### too deep');
    expect(blocks[0].type).toBe('paragraph');
  });

  it('연속된 `- ` 는 하나의 bullets 블록으로 묶는다', () => {
    const blocks = parseMiniMarkdown('- one\n- two\n- three');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('bullets');
    if (blocks[0].type === 'bullets') {
      expect(blocks[0].items).toHaveLength(3);
    }
  });

  it('heading 이 리스트를 끊는다', () => {
    const blocks = parseMiniMarkdown('- a\n# H\n- b');
    expect(blocks.map((b) => b.type)).toEqual(['bullets', 'heading', 'bullets']);
  });

  it('빈 줄은 리스트를 닫고 무시된다', () => {
    const blocks = parseMiniMarkdown('- a\n\nplain');
    expect(blocks.map((b) => b.type)).toEqual(['bullets', 'paragraph']);
  });
});

describe('renderMiniMarkdown — 정적 HTML', () => {
  it('heading + bold + bullet 를 올바른 태그로 렌더', () => {
    const html = renderToStaticMarkup(
      renderMiniMarkdown('## 설계 노트\n본문 **핵심**\n- 항목1\n- 항목2'),
    );
    expect(html).toContain('<h2>설계 노트</h2>');
    expect(html).toContain('<strong>핵심</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>항목1</li>');
    expect(html).toContain('<li>항목2</li>');
  });

  it('미지원 문법(예: `> 인용`)은 평문 문단으로 흘려보낸다', () => {
    const html = renderToStaticMarkup(renderMiniMarkdown('> quoted'));
    expect(html).toContain('<p>&gt; quoted</p>');
    expect(html).not.toContain('<blockquote');
  });

  it('빈 입력은 빈 컨테이너', () => {
    const html = renderToStaticMarkup(renderMiniMarkdown(''));
    expect(html).toContain('mini-md');
  });
});
