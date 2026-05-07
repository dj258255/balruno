/**
 * One-shot translator — reads catalog-ko.json, applies a static
 * Korean → English dictionary to project / sheet / column names +
 * project descriptions, leaves cell values (sample data) alone, and
 * writes catalog-en.json.
 *
 * Sample row data stays in Korean intentionally — class names, item
 * descriptions and the like are reference content that English users
 * are expected to replace with their own. Translating them
 * mechanically risks meaning loss (e.g. "전사" → "Warrior" works, but
 * stat memos like "1순위 탱커" don't translate cleanly).
 *
 * Run from packages/web:
 *   npx vite-node --config vitest.config.ts scripts/translateStarterCatalog.ts
 *
 * The output catalog-en.json drops in alongside catalog-ko.json
 * under packages/backend/src/main/resources/starter/. Backend's
 * StarterPackSeeder picks it up automatically on next boot.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Sheet {
  id: string;
  name: string;
  columns: { id: string; name: string; type?: string; width?: number; selectOptions?: { id: string; label: string }[] }[];
  rows: unknown[];
}

interface Doc {
  id: string;
  name: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

interface Starter {
  id: string;
  i18nKey?: string;
  color?: string;
  project: {
    id: string;
    name: string;
    description?: string;
    sheets: Sheet[];
    docs?: Doc[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Catalog {
  starters: Starter[];
}

// Stable Korean → English dictionary. Entries that don't match a key
// fall through unchanged — better to ship a Korean residue than to
// guess wrong on game-balancing terminology.
const DICT: Record<string, string> = {
  // Project names + descriptions
  '튜토리얼': 'Tutorial',
  '시작용 예시 — 자유롭게 편집/삭제하세요': 'Starter examples — feel free to edit or delete',
  'RPG 프로젝트': 'RPG Project',
  'RPG 밸런싱 시작 팩': 'RPG balancing starter pack',
  'FPS 프로젝트': 'FPS Project',
  'FPS 슈터 밸런싱': 'FPS shooter balancing',
  'MOBA 프로젝트': 'MOBA Project',
  'MOBA 챔피언 밸런싱': 'MOBA champion balancing',
  'RTS 프로젝트': 'RTS Project',
  'RTS 유닛 밸런싱': 'RTS unit balancing',
  'Idle 프로젝트': 'Idle Project',
  'Idle 클리커 밸런싱': 'Idle clicker balancing',
  '덱빌더 프로젝트': 'Deckbuilder Project',
  '로그라이크 덱빌더 밸런싱': 'Roguelike deckbuilder balancing',
  '스프린트 보드': 'Sprint Board',
  'PM 작업 관리': 'Project management',
  '버그 트래커': 'Bug Tracker',
  '버그 관리': 'Bug tracking',
  '로드맵': 'Roadmap',
  '플레이테스트': 'Playtest',
  '플레이테스트 세션 기록': 'Playtest session log',
  '새 프로젝트': 'New Project',

  // Sheet names. '에픽 로드맵' below doubles as a project description
  // for the roadmap starter group — same Korean string maps to the
  // same English on both sides.
  '캐릭터': 'Characters',
  '스프린트': 'Sprint',
  '무기': 'Weapons',
  'EXP 곡선': 'EXP Curve',
  '가챠 확률': 'Gacha Rates',
  'FPS 무기': 'FPS Weapons',
  '챔피언': 'Champions',
  'RTS 유닛': 'RTS Units',
  'Idle 업그레이드': 'Idle Upgrades',
  '카드 덱': 'Card Deck',
  '에픽 로드맵': 'Epic Roadmap',

  // Column names — game stats
  '이름': 'Name',
  '공격력': 'Attack',
  '방어력': 'Defense',
  '공격속도': 'Attack Speed',
  '메모': 'Notes',
  '제목': 'Title',
  '우선순위': 'Priority',
  '담당': 'Assignee',
  '마감': 'Due',
  '타입': 'Type',
  '데미지': 'Damage',
  '사거리': 'Range',
  '쿨다운': 'Cooldown',
  '등급': 'Tier',
  '레벨': 'Level',
  '필요 EXP': 'Required EXP',
  '누적 EXP': 'Total EXP',
  '보상': 'Reward',
  '확률 (%)': 'Rate (%)',
  '피티 (회)': 'Pity (count)',
  '대표 아이템': 'Featured Item',
  '카테고리': 'Category',
  '연사 (RPM)': 'Fire Rate (RPM)',
  '유효사거리(m)': 'Effective Range (m)',
  '반동': 'Recoil',
  'TTK (ms)': 'TTK (ms)',
  '포지션': 'Role',
  'AD': 'AD',
  'AP': 'AP',
  '방어': 'Defense',
  'MR': 'MR',
  '난이도': 'Difficulty',
  '식량': 'Food',
  '골드': 'Gold',
  '생산 (s)': 'Build Time (s)',
  '카운터': 'Counter',
  '유닛': 'Unit',
  '비용': 'Cost',
  '초당 수익': 'Income/sec',
  '회수 시간(s)': 'Payback (s)',
  '카드': 'Card',
  '에너지': 'Energy',
  '효과': 'Effect',
  '희귀도': 'Rarity',
  '버그': 'Bug',
  '심각도': 'Severity',
  '설명': 'Description',
  '재현 단계': 'Repro Steps',
  '스크린샷': 'Screenshot',
  '보고자': 'Reporter',
  '등록일': 'Filed At',
  '에픽': 'Epic',
  '분기': 'Quarter',
  '시작일': 'Start',
  '시작': 'Start',
  '종료일': 'End',
  '진행률 %': 'Progress %',
  '주도': 'Owner',
  '임팩트': 'Impact',
  '세션': 'Session',
  '일자': 'Date',
  '빌드 버전': 'Build',
  '테스터': 'Tester',
  '진행자': 'Host',
  '재미도': 'Fun Score',
  'Pros (좋은 점)': 'Pros',
  'Cons (안 좋은 점)': 'Cons',
  '조치': 'Actions',

  // ── Sample cell values — comprehensive translation.

  // RPG character classes
  '전사': 'Warrior',
  '마법사': 'Mage',
  '도적': 'Rogue',
  '궁수': 'Archer',
  '성기사': 'Paladin',

  // Tutorial weapons / item names
  '롱소드': 'Longsword',
  '아이스 스태프': 'Ice Staff',
  '엘븐 보우': 'Elven Bow',
  '신성 검': 'Holy Sword',
  '검': 'Sword',
  '활': 'Bow',
  '지팡이': 'Staff',
  '총': 'Gun',
  '샷건': 'Shotgun',
  '저격': 'Sniper',

  // Item rarity / shorthand
  '커먼': 'Common',
  '언커먼': 'Uncommon',
  '레어': 'Rare',
  '일반 재료': 'Common Material',
  '레어 재료': 'Rare Material',
  '에픽 무기': 'Epic Weapon',
  '전설 무기': 'Legendary Weapon',
  '신규 무기 데이터': 'New weapon data',
  '신규 챔피언 5종': '5 new champions',

  // MOBA roles / enums
  '근접': 'Melee',
  '원거리': 'Ranged',
  '균형형 탱커': 'Balanced Tank',
  '빠른 딜러': 'Fast Carry',
  '유리대포': 'Glass Cannon',
  '최고 방어': 'Top Defense',
  '원거리 균형': 'Ranged Balanced',
  '탑': 'Top',
  '미드': 'Mid',
  '정글': 'Jungle',
  '원딜': 'ADC',
  '서포터': 'Support',

  // RTS unit families
  '보병': 'Infantry',
  '기병': 'Cavalry',
  '공성탑': 'Siege Tower',

  // Sprint / project mgmt enums
  '미반영': 'Not started',
  '반영 중': 'In progress',
  '반영 완료': 'Done',
  '검토 중': 'In review',
  '파워': 'Power',
  '공격': 'Attack',
  '스킬': 'Skill',
  '스킬 포인트 + 1': 'Skill Point + 1',
  '근력 + 2': 'Strength + 2',
  '5 방어': '5 Defense',
  '6 데미지': '6 Damage',
  '8 광역 데미지': '8 AoE Damage',
  '8 데미지 + 취약 2': '8 Damage + Vulnerable 2',

  // Roadmap / playtest entries
  '나': 'Me',
  '외부': 'External',
  '내부 5명': 'Internal (5)',
  '1차 클로즈드 베타': '1st Closed Beta',
  '2차 친구 5명': '2nd Friends (5)',
  '캐릭터 1차 밸런스': 'Character balance pass 1',
  '튜토리얼 개편': 'Tutorial revamp',
  '인플레이션 검토': 'Inflation review',
  '경제 시스템 v2': 'Economy system v2',
  '튜토리얼 텍스트': 'Tutorial copy',
  '튜토리얼 짧아져서 진입 부드러움.':
    'Tutorial is shorter now, smoother onboarding.',
  '튜토리얼 너무 김 (15분+). 보스 1번이 너무 어려움.':
    'Tutorial too long (15+ min). Boss 1 too hard.',
  '핵심 루프 재미있음. 캐릭터 디자인 호평.':
    'Core loop is fun. Character design well-received.',
  '경제 후반 인플레. 가챠 박애심 (소프트 피티) 부족.':
    'Late-game inflation. Gacha pity (soft pity) feels lacking.',

  // Bug tracker entries
  '도적 크리율 100% 시 데미지 이상': 'Rogue crit-rate 100% damage anomaly',
  '도적 크리율을 100%로 설정하면 일반 공격에 critDamage 배율이 적용되지 않음':
    "When the Rogue's crit rate is set to 100% the critDamage multiplier isn't applied on normal attacks",
  '1) 도적 선택 2) critRate=1, critDamage=2 설정 3) 일반 공격 시 데미지 = base * 1 (예상: base * 2)':
    '1) Pick Rogue 2) Set critRate=1, critDamage=2 3) Normal attack deals base * 1 (expected: base * 2)',
  '경제 시뮬 9999일 시 NaN': 'Economy sim returns NaN at day 9999',
  '시뮬레이션 일수가 10000을 넘으면 supplyOverTime 차트에 NaN 값 표시':
    'When sim days exceed 10000 the supplyOverTime chart shows NaN',
  '경제 설계 → 시뮬 일수 10000 입력 → 차트 보면 후반부 NaN':
    'Economy design → enter 10000 sim days → chart shows NaN in the late portion',

  // ── welcomeDoc HTML — verbatim mapping (markup preserved). ──

  // Shared phrases that appear in every starter's welcomeDoc.
  '<h2>이 워크스페이스에 든 것</h2>': "<h2>What's in this workspace</h2>",
  '<h2>30초 안에 해 볼 것</h2>': '<h2>Try it in 30 seconds</h2>',
  '<li>아무 셀이나 <strong>클릭</strong> → 값 편집</li>':
    '<li><strong>Click</strong> any cell to edit the value</li>',
  '<li>셀에 <code>=</code> → 함수 자동완성 popover</li>':
    '<li>Type <code>=</code> in a cell → formula autocomplete popover</li>',
  '<li>일반 셀에 <code>/</code> → <code>/today</code> <code>/uuid</code> 같은 빠른 명령</li>':
    '<li>Type <code>/</code> in a regular cell → quick commands like <code>/today</code> <code>/uuid</code></li>',
  '<li>행 우클릭 → "이 행으로 시뮬 실행" (hp/atk 컬럼이 있으면)</li>':
    '<li>Right-click a row → "Run simulation with this row" (when hp/atk columns exist)</li>',
  '<li><code>?</code> 키 → 단축키, <code>⌘K</code> → 모든 검색</li>':
    '<li>Press <code>?</code> for shortcuts, <code>⌘K</code> for global search</li>',
  '<p>오른쪽 우하단 코치마크 카드에서 단계별 가이드도 보실 수 있어요.</p>':
    '<p>Step-by-step guides are also available in the coach-mark card at the bottom right.</p>',

  // Per-starter welcomeDoc — H1 + intro paragraph + sheet list +
  // closing tip. The script translates each whole HTML string as
  // one entry; misses fall through unchanged.
  '<h1>FPS 슈터 시작 팩</h1>': '<h1>FPS Shooter Starter Pack</h1>',
  '<h1>Idle 클리커 시작 팩</h1>': '<h1>Idle Clicker Starter Pack</h1>',
  '<h1>MOBA 시작 팩</h1>': '<h1>MOBA Starter Pack</h1>',
  '<h1>RPG 시작 팩</h1>': '<h1>RPG Starter Pack</h1>',
  '<h1>RTS 시작 팩</h1>': '<h1>RTS Starter Pack</h1>',
  '<h1>로그라이크 덱빌더 시작 팩</h1>': '<h1>Roguelike Deckbuilder Starter Pack</h1>',
  '<h1>버그 트래커 시작 팩</h1>': '<h1>Bug Tracker Starter Pack</h1>',
  '<h1>스프린트 보드 시작 팩</h1>': '<h1>Sprint Board Starter Pack</h1>',
  '<h1>에픽 로드맵 시작 팩</h1>': '<h1>Epic Roadmap Starter Pack</h1>',
  '<h1>튜토리얼 시작 팩</h1>': '<h1>Tutorial Starter Pack</h1>',
  '<h1>플레이테스트 시작 팩</h1>': '<h1>Playtest Starter Pack</h1>',

  '<p>FPS 슈터 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the FPS shooter domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>Idle 클리커 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the idle-clicker domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>MOBA 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the MOBA domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>RPG 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the RPG domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>RTS 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the RTS domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>로그라이크 덱빌더 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to the roguelike deckbuilder domain are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>버그 트래커 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to bug tracking are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>스프린트 보드 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to sprint planning are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>에픽 로드맵 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to epic-roadmap planning are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>튜토리얼 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Tutorial sheets are pre-loaded. Start with live data instead of a blank canvas.</p>',
  '<p>플레이테스트 도메인에 맞춘 시트가 미리 들어 있어요. 빈 화면 대신 살아있는 데이터로 즉시 시작하세요.</p>':
    '<p>Sheets tailored to playtest logging are pre-loaded. Start with live data instead of a blank canvas.</p>',

  // Per-starter sheet list.
  '<ul><li><strong>FPS 무기</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>FPS Weapons</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>Idle 업그레이드</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Idle Upgrades</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>챔피언</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Champions</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>캐릭터</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li><li><strong>무기</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li><li><strong>EXP 곡선</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li><li><strong>가챠 확률</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Characters</strong> sheet — click any cell to change the value</li><li><strong>Weapons</strong> sheet — click any cell to change the value</li><li><strong>EXP Curve</strong> sheet — click any cell to change the value</li><li><strong>Gacha Rates</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>RTS 유닛</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>RTS Units</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>카드 덱</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Card Deck</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>버그 트래커</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Bug Tracker</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>스프린트</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Sprint</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>에픽 로드맵</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Epic Roadmap</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>캐릭터</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li><li><strong>스프린트</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Characters</strong> sheet — click any cell to change the value</li><li><strong>Sprint</strong> sheet — click any cell to change the value</li></ul>',
  '<ul><li><strong>플레이테스트</strong> 시트 — 셀 클릭해서 값을 바꿔 보세요</li></ul>':
    '<ul><li><strong>Playtest</strong> sheet — click any cell to change the value</li></ul>',

  // Per-starter design tip (the closing <p> in welcomeDoc).
  '<p>TTK = 1000 / (DPS / target_hp). 카테고리별 평균 TTK 가 비슷해야 균형. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.</p>':
    '<p>TTK = 1000 / (DPS / target_hp). Average TTK across categories should be roughly equal for balance. Use a separate "Sprint Board" project for PM tasks.</p>',
  '<p>회수 시간(s) 가 일정하게 늘어야 진행 곡선 부드러움. 비용 1.5배수 / 수익 1.3배수 가 기본. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.</p>':
    '<p>A steadily increasing payback (s) keeps the progression curve smooth. The defaults: cost 1.5x, income 1.3x. Use a separate "Sprint Board" project for PM tasks.</p>',
  '<p>난이도 별점은 1=쉬움 5=어려움. 같은 포지션 끼리 ad/ap/hp 평균 비교. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.</p>':
    '<p>Difficulty stars: 1 = easy, 5 = hard. Compare ad/ap/hp averages within the same role. Use a separate "Sprint Board" project for PM tasks.</p>',
  '<p>EXP 곡선의 base/rate 만 바꾸면 1-20렙 자동 재계산. 무기는 등급(별점)으로 정렬해 보세요.</p>':
    '<p>Tweaking just base/rate on the EXP Curve auto-recalculates levels 1-20. Try sorting weapons by tier (stars).</p>',
  '<p>카운터 컬럼은 가위바위보. 보병 → 기병 → 궁수 → 보병 같은 순환이 핵심. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.</p>':
    '<p>The Counter column is rock-paper-scissors. The cycle Infantry → Cavalry → Archer → Infantry is the core idea. Use a separate "Sprint Board" project for PM tasks.</p>',
  '<p>희귀도별 평균 데미지/방어 비율 점검. starter 카드는 약하지만 시너지 기반. PM 작업은 별도 "스프린트 보드" 프로젝트 사용.</p>':
    '<p>Check average damage/defense ratios per rarity. Starter cards are weak but synergy-driven. Use a separate "Sprint Board" project for PM tasks.</p>',
  '<p>칸반 뷰 (단축키 K) 로 status 별 카드. 다른 status 로 drag.</p>':
    '<p>Kanban view (shortcut K) lays cards out by status. Drag a card to a different status to move it.</p>',
  '<p>간트 뷰 (단축키 T) 로 분기별 일정 시각화.</p>':
    '<p>Gantt view (shortcut T) visualises the schedule by quarter.</p>',
  '<p>재미도 별점 평균 + 핵심 피드백 텍스트로 회고.</p>':
    '<p>Use the average fun-score plus key feedback text for the retrospective.</p>',
};

function translate(value: string): string {
  return DICT[value] ?? value;
}

function translateSheet(sheet: Sheet): Sheet {
  return {
    ...sheet,
    name: translate(sheet.name),
    columns: sheet.columns.map((col) => ({
      ...col,
      name: translate(col.name),
      selectOptions: col.selectOptions?.map((opt) => ({
        ...opt,
        label: translate(opt.label),
      })),
    })),
    rows: (sheet.rows as Array<{ id: string; cells: Record<string, unknown> }>).map((row) => ({
      ...row,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([k, v]) => [k, translateCellValue(v)]),
      ),
    })),
  };
}

/**
 * Translate a single cell value. The DICT contains entries for
 * plain text, HTML welcomeDoc blocks, and short enum values; misses
 * fall through unchanged so a new value type can ship without
 * breaking the script. Formula expressions (start with '=') skip
 * the lookup since their semantics are language-independent.
 */
function translateCellValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.startsWith('=')) return value;
  return translate(value);
}

/**
 * Multi-line content (welcomeDoc HTML) is stored as one string with
 * embedded newlines. Translate line-by-line so the dict can map each
 * <h1> / <p> / <li> independently — much smaller dict than mapping
 * 14-line blobs verbatim. Lines that don't match fall through.
 */
function translateMultiline(content: string): string {
  return content
    .split('\n')
    .map((line) => translate(line))
    .join('\n');
}

function translateDoc(doc: Doc): Doc {
  return {
    ...doc,
    name: translate(doc.name),
    content: translateMultiline(doc.content),
  };
}

function translateStarter(starter: Starter): Starter {
  return {
    ...starter,
    project: {
      ...starter.project,
      name: translate(starter.project.name),
      description: starter.project.description ? translate(starter.project.description) : undefined,
      sheets: starter.project.sheets.map(translateSheet),
      docs: starter.project.docs?.map(translateDoc),
    },
  };
}

function main(): void {
  const inputPath = resolve(
    __dirname,
    '../../backend/src/main/resources/starter/catalog-ko.json',
  );
  const outputPath = resolve(
    __dirname,
    '../../backend/src/main/resources/starter/catalog-en.json',
  );

  const raw = readFileSync(inputPath, 'utf-8');
  const ko: Catalog = JSON.parse(raw);
  const en: Catalog = {
    starters: ko.starters.map(translateStarter),
  };

  // Pretty-print so the output stays diff-friendly. The runtime
  // parser doesn't care about whitespace.
  writeFileSync(outputPath, JSON.stringify(en, null, 2) + '\n', 'utf-8');

  // Brief summary so the operator sees what landed.
  const totalGroups = en.starters.length;
  const totalSheets = en.starters.reduce((acc, s) => acc + s.project.sheets.length, 0);
  // eslint-disable-next-line no-console
  console.log(`catalog-en.json written: ${totalGroups} groups, ${totalSheets} sheets.`);
}

main();
