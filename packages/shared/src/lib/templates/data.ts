/**
 * 템플릿 데이터 통합 모듈
 *
 * 각 카테고리별 템플릿 파일에서 import하여 통합
 */

import { configTemplates } from './config';
import { characterTemplates } from './character';
import { progressionTemplates } from './progression';
import { combatTemplates } from './combat';
import { economyTemplates } from './economy';
import { contentTemplates } from './content';
import { analysisTemplates } from './analysis';
import type { SheetTemplate } from './types';

// 개별 템플릿 배열도 export (필요시 사용)
export {
  configTemplates,
  characterTemplates,
  progressionTemplates,
  combatTemplates,
  economyTemplates,
  contentTemplates,
  analysisTemplates,
};

// 기존 호환성을 위한 통합 배열
export const sheetTemplates: SheetTemplate[] = [
  ...configTemplates,
  ...characterTemplates,
  ...progressionTemplates,
  ...combatTemplates,
  ...economyTemplates,
  ...contentTemplates,
  ...analysisTemplates,
];
