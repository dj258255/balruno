/**
 * Doc Export — M4.
 *
 * HTML (tiptap 출력) → Markdown / PDF 로 변환.
 * @참조 노드는 resolved 값 또는 syntax 유지 옵션.
 */

import type { Doc, Project } from '@/types';
import { computeSheetRows } from './formulaEngine';

export interface ExportOptions {
  /** resolveRefs: true → @참조 를 현재 값으로 치환. false → @syntax 유지 */
  resolveRefs: boolean;
}

/**
 * HTML → Markdown 변환. (private — exportDocAsMarkdown 만 사용)
 */
function docToMarkdown(
  doc: Doc,
  project: Project | null | undefined,
  options: ExportOptions = { resolveRefs: true },
): string {
  if (typeof window === 'undefined') return doc.content;

  const container = document.createElement('div');
  container.innerHTML = doc.content;

  const lines: string[] = [`# ${doc.name || '(제목 없음)'}`, ''];
  lines.push(...nodeToMarkdown(container, project, options));

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function nodeToMarkdown(
  root: Node,
  project: Project | null | undefined,
  options: ExportOptions,
): string[] {
  const lines: string[] = [];

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text.trim()) lines.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (el.hasAttribute('data-live-cell')) {
      lines.push(renderLiveCellMarkdown(el, project, options));
      return;
    }
    if (el.hasAttribute('data-chart-block')) {
      lines.push(`[차트: ${el.getAttribute('data-sheet')}/${el.getAttribute('data-x')}×${el.getAttribute('data-y')}]`);
      return;
    }
    if (el.hasAttribute('data-task-card')) {
      lines.push(`[태스크: ${el.getAttribute('data-row')}]`);
      return;
    }
    if (el.hasAttribute('data-sim-block')) {
      lines.push(
        `[시뮬: DMG=${el.getAttribute('data-dmg')} SPD=${el.getAttribute('data-spd')} Crit=${el.getAttribute('data-crit')} · ${el.getAttribute('data-iter')}회]`
      );
      return;
    }
    if (el.hasAttribute('data-rationale-block')) {
      lines.push(`[근거: ${el.getAttribute('data-sheet')}/${el.getAttribute('data-col')}/${el.getAttribute('data-row')}]`);
      return;
    }
    if (el.classList.contains('mention-node')) {
      lines.push(`@${el.getAttribute('data-label') || el.textContent || ''}`);
      return;
    }

    switch (tag) {
      case 'h1':
        lines.push('', `# ${inlineMarkdown(el)}`, '');
        break;
      case 'h2':
        lines.push('', `## ${inlineMarkdown(el)}`, '');
        break;
      case 'h3':
        lines.push('', `### ${inlineMarkdown(el)}`, '');
        break;
      case 'p':
        lines.push(inlineMarkdown(el));
        lines.push('');
        break;
      case 'ul':
        el.querySelectorAll(':scope > li').forEach((li) => {
          lines.push(`- ${inlineMarkdown(li as HTMLElement)}`);
        });
        lines.push('');
        break;
      case 'ol':
        el.querySelectorAll(':scope > li').forEach((li, i) => {
          lines.push(`${i + 1}. ${inlineMarkdown(li as HTMLElement)}`);
        });
        lines.push('');
        break;
      case 'blockquote':
        el.childNodes.forEach((n) => {
          const sub = nodeToMarkdown(n, project, options);
          sub.forEach((s) => s && lines.push(`> ${s}`));
        });
        lines.push('');
        break;
      case 'pre': {
        const code = el.textContent ?? '';
        lines.push('```', code, '```', '');
        break;
      }
      case 'hr':
        lines.push('---', '');
        break;
      default:
        lines.push(...nodeToMarkdown(el, project, options));
    }
  });

  return lines;
}

function inlineMarkdown(el: HTMLElement): string {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? '';
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const child = n as HTMLElement;
    const tag = child.tagName.toLowerCase();
    const inner = inlineMarkdown(child);

    if (child.hasAttribute('data-live-cell')) {
      out += `\`${child.getAttribute('data-label') || 'cell'}\``;
      return;
    }
    if (child.classList.contains('mention-node')) {
      out += `@${child.getAttribute('data-label') || child.textContent}`;
      return;
    }

    switch (tag) {
      case 'strong':
      case 'b':
        out += `**${inner}**`;
        break;
      case 'em':
      case 'i':
        out += `*${inner}*`;
        break;
      case 'code':
        out += `\`${inner}\``;
        break;
      case 'a': {
        const href = child.getAttribute('href') ?? '';
        out += `[${inner}](${href})`;
        break;
      }
      case 'br':
        out += '\n';
        break;
      default:
        out += inner;
    }
  });
  return out.trim();
}

function renderLiveCellMarkdown(
  el: HTMLElement,
  project: Project | null | undefined,
  options: ExportOptions,
): string {
  const sheetId = el.getAttribute('data-sheet') ?? '';
  const columnId = el.getAttribute('data-col') ?? '';
  const rowId = el.getAttribute('data-row') ?? '';
  const label = el.getAttribute('data-label') ?? 'cell';

  if (!options.resolveRefs || !project) {
    return `\`@${label}\``;
  }

  const sheet = project.sheets.find((s) => s.id === sheetId);
  if (!sheet) return `\`@${label}\``;
  const column = sheet.columns.find((c) => c.id === columnId);
  const row = sheet.rows.find((r) => r.id === rowId);
  if (!column || !row) return `\`@${label}\``;

  let v: unknown = row.cells[column.id];
  const isFormula = column.type === 'formula' || (typeof v === 'string' && String(v).startsWith('='));
  if (isFormula) {
    try {
      const computed = computeSheetRows(sheet, project.sheets);
      const cRow = computed[sheet.rows.indexOf(row)];
      if (cRow) v = cRow[column.name];
    } catch {
      // fallback raw
    }
  }
  const displayValue = v === null || v === undefined || v === '' ? '—' : String(v);
  return `\`${displayValue}\` *(${sheet.name}/${column.name})*`;
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportDocAsMarkdown(
  doc: Doc,
  project: Project | null | undefined,
  options: ExportOptions = { resolveRefs: true },
): void {
  const md = docToMarkdown(doc, project, options);
  const safeName = (doc.name || 'document').replace(/[^\w가-힣\s-]/g, '_').trim();
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(md, `${safeName}-${date}.md`, 'text/markdown;charset=utf-8');
}

/**
 * PDF export — new window + 시스템 인쇄 다이얼로그 ("PDF 로 저장").
 * DOM 을 직접 구성해서 document.write 회피.
 */
export function exportDocAsPDF(doc: Doc, project: Project | null | undefined): void {
  if (typeof window === 'undefined') return;

  const temp = document.createElement('div');
  temp.innerHTML = doc.content;

  // Live cell 노드 → 값 치환
  temp.querySelectorAll('[data-live-cell]').forEach((el) => {
    const label = el.getAttribute('data-label') ?? 'cell';
    const sheetId = el.getAttribute('data-sheet') ?? '';
    const columnId = el.getAttribute('data-col') ?? '';
    const rowId = el.getAttribute('data-row') ?? '';
    let text = label;
    if (project) {
      const sheet = project.sheets.find((s) => s.id === sheetId);
      const column = sheet?.columns.find((c) => c.id === columnId);
      const row = sheet?.rows.find((r) => r.id === rowId);
      if (sheet && column && row) {
        let v: unknown = row.cells[column.id];
        const isFormula = column.type === 'formula' || (typeof v === 'string' && String(v).startsWith('='));
        if (isFormula) {
          try {
            const computed = computeSheetRows(sheet, project.sheets);
            const cRow = computed[sheet.rows.indexOf(row)];
            if (cRow) v = cRow[column.name];
          } catch {
            // fallback
          }
        }
        const displayValue = v === null || v === undefined || v === '' ? '—' : String(v);
        text = `${displayValue} (${sheet.name}/${column.name})`;
      }
    }
    const span = document.createElement('span');
    span.textContent = text;
    span.style.fontFamily = 'monospace';
    span.style.background = '#f0f9ff';
    span.style.padding = '1px 4px';
    span.style.borderRadius = '3px';
    el.replaceWith(span);
  });

  // 다른 custom blocks → placeholder
  const replaceWithEm = (selector: string, textFactory: (el: Element) => string) => {
    temp.querySelectorAll(selector).forEach((el) => {
      const p = document.createElement('p');
      const em = document.createElement('em');
      em.textContent = textFactory(el);
      p.appendChild(em);
      el.replaceWith(p);
    });
  };
  replaceWithEm('[data-chart-block]', (el) =>
    `[차트: ${el.getAttribute('data-sheet')}/${el.getAttribute('data-x')} × ${el.getAttribute('data-y')}]`
  );
  replaceWithEm('[data-task-card]', () => '[태스크 카드]');
  replaceWithEm('[data-sim-block]', (el) => `[Monte Carlo 시뮬 · ${el.getAttribute('data-iter')}회]`);
  replaceWithEm('[data-rationale-block]', () => '[근거 자동 생성 블록]');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('팝업 차단을 해제해주세요.');
    return;
  }

  const printDoc = printWindow.document;

  // head
  const head = printDoc.head;
  const meta = printDoc.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.appendChild(meta);
  const titleEl = printDoc.createElement('title');
  titleEl.textContent = doc.name || '문서';
  head.appendChild(titleEl);
  const style = printDoc.createElement('style');
  style.textContent = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2em auto; padding: 1em; line-height: 1.65; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #3b82f6; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; margin-top: 1.5em; }
    h3 { margin-top: 1em; }
    code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; color: #6b7280; font-style: italic; }
    ul, ol { padding-left: 1.5em; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
    .meta { color: #9ca3af; font-size: 0.85em; margin-bottom: 2em; }
  `;
  head.appendChild(style);

  // body
  const body = printDoc.body;
  const h1 = printDoc.createElement('h1');
  h1.textContent = doc.name || '문서';
  body.appendChild(h1);
  const metaP = printDoc.createElement('p');
  metaP.className = 'meta';
  metaP.textContent = `수정: ${new Date(doc.updatedAt).toLocaleString('ko-KR')}`;
  body.appendChild(metaP);
  const contentDiv = printDoc.createElement('div');
  contentDiv.innerHTML = temp.innerHTML;
  body.appendChild(contentDiv);

  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
