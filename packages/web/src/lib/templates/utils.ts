import { v4 as uuidv4 } from 'uuid';
import type { Sheet, Column, Row } from '@/types';
import type { SheetTemplate } from './types';

// Create sheet from template
export function createSheetFromTemplate(template: SheetTemplate): Sheet {
  const now = Date.now();

  // 첫 번째 sampleRow에서 수식 열의 formula 값 추출
  const firstSampleRow = template.sampleRows?.[0];
  const formulaMap: Record<number, string> = {};

  if (firstSampleRow) {
    template.columns.forEach((col, index) => {
      if (col.type === 'formula') {
        const cellKey = `col${index}`;
        const cellValue = firstSampleRow.cells[cellKey];
        if (typeof cellValue === 'string' && cellValue.startsWith('=')) {
          formulaMap[index] = cellValue;
        }
      }
    });
  }

  // Create columns with IDs (수식 열에 formula 속성 자동 설정)
  const columns: Column[] = template.columns.map((col, index) => ({
    ...col,
    id: uuidv4(),
    // 수식 열이면서 formula가 없으면 sampleRow에서 추출한 수식 사용
    formula: col.type === 'formula' ? (col.formula || formulaMap[index]) : undefined,
  }));

  // Create sample data (map column IDs)
  const rows: Row[] = (template.sampleRows || []).map((sampleRow) => {
    const cells: Record<string, string | number | null> = {};

    // Map col0, col1, col2... keys to actual column IDs
    Object.entries(sampleRow.cells).forEach(([key, value]) => {
      const index = parseInt(key.replace('col', ''));
      if (!isNaN(index) && columns[index]) {
        cells[columns[index].id] = value;
      }
    });

    return {
      id: uuidv4(),
      cells,
    };
  });

  return {
    id: uuidv4(),
    name: template.name,
    columns,
    rows,
    createdAt: now,
    updatedAt: now,
  };
}

// Get templates by category
export function getTemplatesByCategory(category: string): SheetTemplate[] {
  // Lazy import to avoid circular dependency
  const { sheetTemplates } = require('./data');
  return sheetTemplates.filter((t: SheetTemplate) => t.category === category);
}
