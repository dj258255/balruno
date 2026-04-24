/**
 * Tour step definitions for sample projects
 * Each sample project can have its own interactive tour
 */

export interface TourStepTarget {
  type: 'cell' | 'column' | 'row' | 'area' | 'none';
  // For 'cell' type: specific cell coordinates
  cellCoords?: { rowIndex: number; colIndex: number };
  // For 'column' type: column index
  columnIndex?: number;
  // For 'row' type: row index
  rowIndex?: number;
  // For 'area' type: rectangular region
  area?: { startRow: number; endRow: number; startCol: number; endCol: number };
}

export interface TourStep {
  id: string;
  titleKey: string; // i18n key for title
  descriptionKey: string; // i18n key for description
  target: TourStepTarget;
  action?: 'click' | 'edit' | 'observe'; // What the user should do
  highlightIntensity?: 'low' | 'medium' | 'high'; // Spotlight intensity
}

export interface ProjectTour {
  projectId: string;
  steps: TourStep[];
}

// ============================================
// RPG Character Tour
// ============================================
const rpgCharacterTour: ProjectTour = {
  projectId: 'rpg-character',
  steps: [
    {
      id: 'welcome',
      titleKey: 'tour.rpgCharacter.welcome.title',
      descriptionKey: 'tour.rpgCharacter.welcome.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
    {
      id: 'atk-column',
      titleKey: 'tour.rpgCharacter.atk.title',
      descriptionKey: 'tour.rpgCharacter.atk.description',
      target: { type: 'column', columnIndex: 2 }, // ATK column (col3)
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'dps-formula',
      titleKey: 'tour.rpgCharacter.dps.title',
      descriptionKey: 'tour.rpgCharacter.dps.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 6 } }, // DPS cell for Warrior
      action: 'click',
      highlightIntensity: 'high',
    },
    {
      id: 'hp-edit',
      titleKey: 'tour.rpgCharacter.hp.title',
      descriptionKey: 'tour.rpgCharacter.hp.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 1 } }, // HP cell for Warrior
      action: 'edit',
      highlightIntensity: 'high',
    },
    {
      id: 'ehp-observe',
      titleKey: 'tour.rpgCharacter.ehp.title',
      descriptionKey: 'tour.rpgCharacter.ehp.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 7 } }, // EHP cell for Warrior
      action: 'observe',
      highlightIntensity: 'high',
    },
    {
      id: 'tools',
      titleKey: 'tour.rpgCharacter.tools.title',
      descriptionKey: 'tour.rpgCharacter.tools.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
  ],
};

// ============================================
// Weapon Balance Tour
// ============================================
const weaponBalanceTour: ProjectTour = {
  projectId: 'weapon-balance',
  steps: [
    {
      id: 'welcome',
      titleKey: 'tour.weaponBalance.welcome.title',
      descriptionKey: 'tour.weaponBalance.welcome.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
    {
      id: 'dps-column',
      titleKey: 'tour.weaponBalance.dps.title',
      descriptionKey: 'tour.weaponBalance.dps.description',
      target: { type: 'column', columnIndex: 5 }, // DPS column
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'efficiency',
      titleKey: 'tour.weaponBalance.efficiency.title',
      descriptionKey: 'tour.weaponBalance.efficiency.description',
      target: { type: 'column', columnIndex: 6 }, // Efficiency column
      action: 'observe',
      highlightIntensity: 'high',
    },
    {
      id: 'compare',
      titleKey: 'tour.weaponBalance.compare.title',
      descriptionKey: 'tour.weaponBalance.compare.description',
      target: { type: 'area', area: { startRow: 0, endRow: 2, startCol: 0, endCol: 6 } },
      action: 'observe',
      highlightIntensity: 'medium',
    },
  ],
};

// ============================================
// EXP Curve Tour
// ============================================
const expCurveTour: ProjectTour = {
  projectId: 'exp-curve',
  steps: [
    {
      id: 'welcome',
      titleKey: 'tour.expCurve.welcome.title',
      descriptionKey: 'tour.expCurve.welcome.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
    {
      id: 'formula',
      titleKey: 'tour.expCurve.formula.title',
      descriptionKey: 'tour.expCurve.formula.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 1 } }, // RequiredEXP formula
      action: 'click',
      highlightIntensity: 'high',
    },
    {
      id: 'growth-rate',
      titleKey: 'tour.expCurve.growthRate.title',
      descriptionKey: 'tour.expCurve.growthRate.description',
      target: { type: 'column', columnIndex: 3 }, // GrowthRate column
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'visualize',
      titleKey: 'tour.expCurve.visualize.title',
      descriptionKey: 'tour.expCurve.visualize.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
  ],
};

// ============================================
// Gacha Rates Tour
// ============================================
const gachaRatesTour: ProjectTour = {
  projectId: 'gacha-rates',
  steps: [
    {
      id: 'welcome',
      titleKey: 'tour.gachaRates.welcome.title',
      descriptionKey: 'tour.gachaRates.welcome.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
    {
      id: 'pity-system',
      titleKey: 'tour.gachaRates.pity.title',
      descriptionKey: 'tour.gachaRates.pity.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 2 } }, // Pity cell for SSR
      action: 'observe',
      highlightIntensity: 'high',
    },
    {
      id: 'expected-cost',
      titleKey: 'tour.gachaRates.expectedCost.title',
      descriptionKey: 'tour.gachaRates.expectedCost.description',
      target: { type: 'column', columnIndex: 5 }, // ExpectedCost column
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'adjust-rates',
      titleKey: 'tour.gachaRates.adjustRates.title',
      descriptionKey: 'tour.gachaRates.adjustRates.description',
      target: { type: 'cell', cellCoords: { rowIndex: 0, colIndex: 1 } }, // Rate cell for SSR
      action: 'edit',
      highlightIntensity: 'high',
    },
  ],
};

// ============================================
// Sprint Board Tour (PM)
// ============================================
const sprintBoardTour: ProjectTour = {
  projectId: 'sprint-board',
  steps: [
    {
      id: 'welcome',
      titleKey: 'tour.sprintBoard.welcome.title',
      descriptionKey: 'tour.sprintBoard.welcome.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
    {
      id: 'status-column',
      titleKey: 'tour.sprintBoard.status.title',
      descriptionKey: 'tour.sprintBoard.status.description',
      target: { type: 'column', columnIndex: 2 }, // Status column
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'priority-column',
      titleKey: 'tour.sprintBoard.priority.title',
      descriptionKey: 'tour.sprintBoard.priority.description',
      target: { type: 'column', columnIndex: 3 }, // Priority
      action: 'observe',
      highlightIntensity: 'medium',
    },
    {
      id: 'assignee-edit',
      titleKey: 'tour.sprintBoard.assignee.title',
      descriptionKey: 'tour.sprintBoard.assignee.description',
      target: { type: 'cell', cellCoords: { rowIndex: 3, colIndex: 5 } }, // 빈 Assignee 셀 (GAME-104)
      action: 'edit',
      highlightIntensity: 'high',
    },
    {
      id: 'kanban-view',
      titleKey: 'tour.sprintBoard.kanban.title',
      descriptionKey: 'tour.sprintBoard.kanban.description',
      target: { type: 'none' },
      action: 'observe',
      highlightIntensity: 'low',
    },
    {
      id: 'record-detail',
      titleKey: 'tour.sprintBoard.detail.title',
      descriptionKey: 'tour.sprintBoard.detail.description',
      target: { type: 'row', rowIndex: 0 }, // GAME-101 row
      action: 'click',
      highlightIntensity: 'high',
    },
    {
      id: 'inbox-wrap',
      titleKey: 'tour.sprintBoard.inbox.title',
      descriptionKey: 'tour.sprintBoard.inbox.description',
      target: { type: 'none' },
      highlightIntensity: 'low',
    },
  ],
};

// ============================================
// Export tour definitions
// ============================================
export const PROJECT_TOURS: ProjectTour[] = [
  rpgCharacterTour,
  weaponBalanceTour,
  expCurveTour,
  gachaRatesTour,
  sprintBoardTour,
];

// Helper: Get tour by project ID
export const getTourByProjectId = (projectId: string): ProjectTour | undefined => {
  return PROJECT_TOURS.find((tour) => tour.projectId === projectId);
};

// Helper: Check if project has a tour
export const hasProjectTour = (projectId: string): boolean => {
  return PROJECT_TOURS.some((tour) => tour.projectId === projectId);
};
