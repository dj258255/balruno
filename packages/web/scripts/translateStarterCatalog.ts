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

interface Starter {
  id: string;
  i18nKey?: string;
  color?: string;
  project: {
    id: string;
    name: string;
    description?: string;
    sheets: Sheet[];
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
  '에픽 로드맵': 'Epic roadmap',
  '플레이테스트': 'Playtest',
  '플레이테스트 세션 기록': 'Playtest session log',
  '새 프로젝트': 'New Project',

  // Sheet names
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
      // Select option labels stay as-is for now — they're often
      // status enums (To Do / Doing / …) that are already English
      // or game-specific terms that need design-level translation.
    })),
    // rows kept verbatim — sample data, see file header.
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
