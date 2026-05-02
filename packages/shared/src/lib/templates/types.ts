import type { Column, Row, ColumnType } from '@/types';

// Template type definitions
export interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  genre?: string[]; // Suitable genres
  columns: Omit<Column, 'id'>[];
  sampleRows?: Omit<Row, 'id'>[];
  // Context description for template usage
  context?: string;
  // Key metrics description
  keyMetrics?: string[];
  // Dependencies on other templates (for sheet references)
  dependencies?: {
    templateId: string;
    sheetName: string; // Sheet name for references
    description: string; // Why it's needed
  }[];
}

export interface GameGenre {
  id: string;
  nameKey: string;
  descKey: string;
  name: string;
  description: string;
}

export interface TemplateCategory {
  id: string;
  nameKey: string;
  name: string;
  icon: string;
}
