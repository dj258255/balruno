/**
 * Starter Pack — 새 프로젝트(또는 첫 진입) 시 자동으로 시드되는 sample 묶음.
 *
 * 목적: Notion / Airtable 처럼 첫 진입 시 빈 화면이 아니라 살아있는 데이터를 보여줌.
 * 사용자가 즉시 "이게 뭐고 어떻게 쓰는지" 손으로 만지며 학습.
 *
 * 구성:
 *  - "캐릭터 (예시)" — game-data 시트 + 5명 + hp/atk/def/speed 컬럼
 *  - "스프린트 백로그 (예시)" — pm 시트 + 5작업 + status/assignee/cycle
 *  - "Welcome" — 짧은 가이드 문서 (Tiptap HTML)
 */

import { v4 as uuidv4 } from 'uuid';
import type { Project, Sheet, Column, Row, Doc } from '@/types';

const now = () => Date.now();

function makeColumn(partial: Pick<Column, 'name' | 'type'> & Partial<Column>): Column {
  return {
    id: uuidv4(),
    width: 140,
    ...partial,
  } as Column;
}

function makeRow(cells: Record<string, unknown>): Row {
  return { id: uuidv4(), cells: cells as Row['cells'] };
}

function buildCharacterSheet(): Sheet {
  const colName = makeColumn({ name: '이름', type: 'general', width: 140 });
  const colHp = makeColumn({ name: 'HP', type: 'general', width: 90 });
  const colAtk = makeColumn({ name: '공격력', type: 'general', width: 90 });
  const colDef = makeColumn({ name: '방어력', type: 'general', width: 90 });
  const colSpeed = makeColumn({ name: '공격속도', type: 'general', width: 100 });
  const colNote = makeColumn({ name: '메모', type: 'general', width: 200 });

  const rows: Row[] = [
    makeRow({ [colName.id]: '전사', [colHp.id]: 200, [colAtk.id]: 30, [colDef.id]: 20, [colSpeed.id]: 1.0, [colNote.id]: '높은 HP, 균형형' }),
    makeRow({ [colName.id]: '도적', [colHp.id]: 120, [colAtk.id]: 45, [colDef.id]: 8, [colSpeed.id]: 1.6, [colNote.id]: '낮은 HP, 빠른 공격' }),
    makeRow({ [colName.id]: '마법사', [colHp.id]: 100, [colAtk.id]: 50, [colDef.id]: 5, [colSpeed.id]: 0.9, [colNote.id]: '낮은 HP, 큰 데미지' }),
    makeRow({ [colName.id]: '성기사', [colHp.id]: 220, [colAtk.id]: 25, [colDef.id]: 28, [colSpeed.id]: 0.8, [colNote.id]: '최고 방어' }),
    makeRow({ [colName.id]: '궁수', [colHp.id]: 130, [colAtk.id]: 38, [colDef.id]: 10, [colSpeed.id]: 1.3, [colNote.id]: '원거리, 균형' }),
  ];

  return {
    id: uuidv4(),
    name: '캐릭터 (예시)',
    columns: [colName, colHp, colAtk, colDef, colSpeed, colNote],
    rows,
    createdAt: now(),
    updatedAt: now(),
    kind: 'game-data',
  };
}

function buildSprintSheet(): Sheet {
  const colTitle = makeColumn({ name: '제목', type: 'general', width: 220 });
  const colStatus = makeColumn({
    name: 'Status',
    type: 'select',
    width: 110,
    selectOptions: [
      { id: 'todo', label: 'Todo', color: '#94a3b8' },
      { id: 'doing', label: 'Doing', color: '#3b82f6' },
      { id: 'done', label: 'Done', color: '#10b981' },
    ],
  });
  const colAssignee = makeColumn({ name: '담당', type: 'general', width: 100 });
  const colDue = makeColumn({ name: '마감', type: 'date', width: 120 });

  const rows: Row[] = [
    makeRow({ [colTitle.id]: '캐릭터 밸런스 1차 패스', [colStatus.id]: 'doing', [colAssignee.id]: '나', [colDue.id]: '' }),
    makeRow({ [colTitle.id]: '신규 무기 5종 데이터', [colStatus.id]: 'todo', [colAssignee.id]: '나', [colDue.id]: '' }),
    makeRow({ [colTitle.id]: '경제 시뮬 인플레이션 검토', [colStatus.id]: 'todo', [colAssignee.id]: '나', [colDue.id]: '' }),
    makeRow({ [colTitle.id]: '튜토리얼 단계 텍스트 검토', [colStatus.id]: 'done', [colAssignee.id]: '나', [colDue.id]: '' }),
    makeRow({ [colTitle.id]: '버그: 도적 크리율 100% 시 데미지 이상', [colStatus.id]: 'todo', [colAssignee.id]: '나', [colDue.id]: '' }),
  ];

  return {
    id: uuidv4(),
    name: '스프린트 (예시)',
    columns: [colTitle, colStatus, colAssignee, colDue],
    rows,
    createdAt: now(),
    updatedAt: now(),
    kind: 'pm',
  };
}

function buildWelcomeDoc(): Doc {
  const content = `<h1>환영합니다 👋</h1>
<p>이 워크스페이스는 게임 밸런싱을 위한 통합 도구예요. 빈 화면 대신 시작용 시트 두 개가 미리 들어 있습니다.</p>
<h2>먼저 둘러보기</h2>
<ul>
<li><strong>캐릭터 (예시)</strong> — 5명 캐릭터의 hp/공격력/방어력/공격속도. 셀 클릭해서 편집해 보세요.</li>
<li><strong>스프린트 (예시)</strong> — 작업 5개. 칸반 뷰(<code>K</code>)로 전환하면 status 별 카드.</li>
</ul>
<h2>30초 안에 해 볼 것</h2>
<ol>
<li>캐릭터 시트의 <strong>한 행을 우클릭</strong> → "이 행으로 시뮬 실행". 시뮬 패널이 열리고 데이터가 자동 채워져요.</li>
<li>셀에 <code>=</code> 입력 → 함수 자동완성이 떠요. <code>=DAMAGE(공격력, 방어력)</code> 같은 게 가능.</li>
<li>일반 셀에 <code>/</code> 입력 → <code>/today</code> <code>/uuid</code> 같은 빠른 명령.</li>
<li><code>?</code> 키 → 단축키 목록.</li>
<li><code>⌘K</code> → 모든 시트·도구 빠른 검색.</li>
</ol>
<h2>이 워크스페이스가 가진 것</h2>
<p><strong>시트</strong>는 데이터(캐릭터/무기) · 작업(스프린트/버그) · 분석(시뮬 결과) 어디든 됩니다. 우클릭 → "용도 변경" 으로 시트 종류를 바꿀 수 있어요.</p>
<p><strong>오른쪽 도구 패널</strong>: 수식 헬퍼 · 전투 시뮬 · 경제 워크벤치 · 곡선 비교 등. 처음엔 <strong>전투 시뮬</strong>과 <strong>수식 헬퍼</strong>부터 친해지면 됩니다.</p>
<p>막히면 화면 하단의 <code>?</code> 또는 좌측 도움말을 눌러보세요.</p>`;
  return {
    id: uuidv4(),
    name: 'Welcome',
    icon: '👋',
    content,
    createdAt: now(),
    updatedAt: now(),
  };
}

/**
 * Starter Pack 으로 채워진 Project 생성 — id/createdAt 등은 호출자가 set.
 * 반환된 객체를 createProject 흐름에서 그대로 사용하거나, sheets/docs 만 추출해
 * 기존 프로젝트에 추가도 가능.
 */
export function buildStarterProject(name = '튜토리얼'): Project {
  return {
    id: uuidv4(),
    name,
    description: '시작용 예시 데이터 — 자유롭게 편집/삭제하세요',
    createdAt: now(),
    updatedAt: now(),
    sheets: [buildCharacterSheet(), buildSprintSheet()],
    docs: [buildWelcomeDoc()],
  };
}
