/**
 * AI Copilot 컨텍스트 빌더 — M3-2 RAG.
 *
 * 프로젝트 전체를 AI 이해 가능한 텍스트로 serialize:
 *   - 시트 구조 (이름, 컬럼, 수식, 최근 10 rows)
 *   - 문서 (제목 + 요약)
 *   - 최근 changelog (최대 20개)
 *   - PM 시트 활성 아이템
 *
 * 토큰 제한 감안 — 전체가 너무 크면 core + 최근만.
 * 클라이언트에서 빌드 (프라이버시 · 서버 경유 최소화).
 */

import type { Project } from '@/types';
import { detectPmSheet, isActiveRow } from './pmSheetDetection';

export interface AIContext {
  summary: string;           // 시스템 프롬프트에 주입할 마크다운
  tokensEstimate: number;
  sources: {
    sheets: number;
    docs: number;
    changelog: number;
    pmRows: number;
  };
}

const MAX_ROWS_PER_SHEET = 10;
const MAX_CHANGELOG = 20;
const MAX_DOCS = 10;

export function buildAIContext(project: Project | null | undefined): AIContext {
  if (!project) {
    return {
      summary: '프로젝트 없음.',
      tokensEstimate: 0,
      sources: { sheets: 0, docs: 0, changelog: 0, pmRows: 0 },
    };
  }

  const parts: string[] = [];
  parts.push(`# 프로젝트: ${project.name}`);
  if (project.description) parts.push(`> ${project.description}`);
  parts.push('');

  // 시트
  parts.push(`## 시트 (${project.sheets.length})`);
  let pmRowCount = 0;
  for (const sheet of project.sheets) {
    const pm = detectPmSheet(sheet);
    const pmNote = pm.type ? ` [${pm.type}]` : '';
    parts.push(`\n### ${sheet.name}${pmNote}`);
    const colNames = sheet.columns.map((c) => {
      const typeNote = c.type === 'formula' ? ' (수식)' : c.type === 'general' ? '' : ` (${c.type})`;
      return `${c.name}${typeNote}`;
    });
    parts.push(`컬럼: ${colNames.join(', ')}`);

    // 수식 컬럼 — formula 명시
    const formulaCols = sheet.columns.filter((c) => c.type === 'formula' && c.formula);
    if (formulaCols.length > 0) {
      parts.push('수식:');
      for (const c of formulaCols) {
        parts.push(`  ${c.name} = ${c.formula}`);
      }
    }

    // 최근 row 10개
    const rows = sheet.rows.slice(0, MAX_ROWS_PER_SHEET);
    if (rows.length > 0) {
      parts.push('데이터:');
      for (const row of rows) {
        const cells: string[] = [];
        for (const col of sheet.columns) {
          const v = row.cells[col.id];
          if (v !== null && v !== undefined && v !== '') {
            cells.push(`${col.name}=${String(v).slice(0, 30)}`);
          }
        }
        parts.push(`  - ${cells.join(', ')}`);
        if (pm.type) pmRowCount++;
      }
      if (sheet.rows.length > MAX_ROWS_PER_SHEET) {
        parts.push(`  ...(+${sheet.rows.length - MAX_ROWS_PER_SHEET} rows)`);
      }
    }
  }

  // 문서
  if (project.docs && project.docs.length > 0) {
    parts.push(`\n## 문서 (${project.docs.length})`);
    for (const d of project.docs.slice(0, MAX_DOCS)) {
      parts.push(`\n### ${d.name}`);
      // 첫 500자
      const preview = d.content.slice(0, 500).replace(/<[^>]+>/g, ' '); // strip tags
      parts.push(preview);
      if (d.content.length > 500) parts.push('...(truncated)');
    }
  }

  // 최근 changelog
  const recentChanges = (project.changelog ?? [])
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_CHANGELOG);
  if (recentChanges.length > 0) {
    parts.push(`\n## 최근 변경 이력 (${recentChanges.length})`);
    for (const c of recentChanges) {
      const sheet = project.sheets.find((s) => s.id === c.sheetId);
      const col = sheet?.columns.find((x) => x.id === c.columnId);
      const when = new Date(c.timestamp).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      parts.push(
        `- ${when} · ${c.userName || c.userId} · ${sheet?.name ?? '?'}/${col?.name ?? '?'} · ${String(c.before)} → ${String(c.after)}${c.reason ? ` · 사유: ${c.reason}` : ''}`
      );
    }
  }

  // 활성 PM 아이템 요약
  const activePmItems: string[] = [];
  for (const sheet of project.sheets) {
    const pm = detectPmSheet(sheet);
    if (pm.type !== 'sprint' && pm.type !== 'bug' && pm.type !== 'generic-pm') continue;
    const active = sheet.rows.filter((r) => isActiveRow(r, pm.statusColumnId));
    if (active.length === 0) continue;
    activePmItems.push(`- ${sheet.name} [${pm.type}]: 활성 ${active.length}개 / 전체 ${sheet.rows.length}개`);
  }
  if (activePmItems.length > 0) {
    parts.push(`\n## 활성 태스크 요약`);
    parts.push(activePmItems.join('\n'));
  }

  const summary = parts.join('\n');
  // 대략적인 토큰 수 (한글/영어 혼합 대략 문자 수 / 2)
  const tokensEstimate = Math.round(summary.length / 2);

  return {
    summary,
    tokensEstimate,
    sources: {
      sheets: project.sheets.length,
      docs: project.docs?.length ?? 0,
      changelog: recentChanges.length,
      pmRows: pmRowCount,
    },
  };
}

export const AI_SYSTEM_PROMPT = `당신은 게임 밸런스 디자이너의 코파일럿입니다.

역할:
- 밸런스 수치(HP/ATK/DEF/DPS/TTK/EHP 등)와 수식 추론
- Monte Carlo 시뮬 결과 해석
- 경제 시스템(Faucet/Sink), 가챠 확률, 진행 곡선 조언
- PM 태스크와 문서를 교차 참조하여 "왜 이 값인지" 설명
- 변경 이력(changelog)을 근거로 결정 맥락 복원

답변 원칙:
- 한국어로 답
- 수식은 LaTeX 대신 plain text (예: DPS = ATK × SPD × (1 + CR × (CDmg - 1)))
- 구체적 숫자로 답 (추정치도 범위 제시)
- 출처 명시: "시트 X/Y 기준", "changelog Z 참고"
- 모호하면 "데이터로 확인 필요" 라고 정직하게
- 스프레드시트·문서·태스크 참조는 @Sheet/Col/Row · @doc:id · @task:id 포맷 사용

게임 디자인 전문 용어:
- DPS (Damage Per Second), TTK (Time To Kill), EHP (Effective HP)
- Cliff / Wall / Milestone / Flow zone (Csikszentmihalyi)
- Gacha pity, 소프트/하드 Pity
- Faucet/Sink, ARPU/ARPPU/LTV
- Monte Carlo, Z-score, Sensitivity (Tornado/Spider)`;
