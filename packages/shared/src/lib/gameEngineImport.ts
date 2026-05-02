/**
 * 게임 엔진 Import (Unity/Unreal/Godot)
 * 게임 엔진 형식의 데이터를 시트 데이터로 변환
 */

import type { Column, Row, CellValue, ColumnType } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Import 형식
export type ImportFormat =
  | 'json'              // 일반 JSON (배열 형태)
  | 'unity_json'        // Unity용 JSON (items 배열)
  | 'csv'               // CSV
  | 'unreal_csv'        // Unreal DataTable CSV
  | 'unity_cs'          // Unity C# 클래스
  | 'godot_gd'          // Godot GDScript
  | 'unreal_h';         // Unreal C++ Header

export interface ImportResult {
  success: boolean;
  columns: Omit<Column, 'id'>[];
  rows: { cells: Record<string, CellValue> }[];
  error?: string;
  warnings?: string[];
}

/**
 * JSON 파싱 (일반 배열)
 */
function parseJsonArray(content: string): ImportResult {
  try {
    const data = JSON.parse(content);

    // 배열인지 확인
    let items: Record<string, unknown>[];
    if (Array.isArray(data)) {
      items = data;
    } else if (data.items && Array.isArray(data.items)) {
      // Unity JSON 형식
      items = data.items;
    } else if (typeof data === 'object') {
      // 단일 객체를 배열로 변환
      items = [data];
    } else {
      return { success: false, columns: [], rows: [], error: '유효한 JSON 배열이 아닙니다.' };
    }

    if (items.length === 0) {
      return { success: false, columns: [], rows: [], error: '데이터가 비어있습니다.' };
    }

    // 모든 키 수집
    const allKeys = new Set<string>();
    for (const item of items) {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    }

    // 컬럼 생성
    const columns: Omit<Column, 'id'>[] = Array.from(allKeys).map(key => ({
      name: key,
      type: inferColumnType(items, key),
      width: key.length > 10 ? 150 : 100,
    }));

    // 임시 ID 매핑 (컬럼명 -> ID)
    const columnIdMap = new Map<string, string>();
    columns.forEach(col => {
      columnIdMap.set(col.name, uuidv4());
    });

    // 행 생성
    const rows = items.map(item => {
      const cells: Record<string, CellValue> = {};
      for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
        const colId = columnIdMap.get(key);
        if (colId) {
          cells[colId] = convertValue(value);
        }
      }
      return { cells };
    });

    // 컬럼에 ID 추가
    const columnsWithIds = columns.map(col => ({
      ...col,
      id: columnIdMap.get(col.name)!,
    }));

    return {
      success: true,
      columns: columnsWithIds.map(({ id, ...rest }) => rest),
      rows,
      warnings: items.length > 1000 ? ['대용량 데이터입니다. 성능에 영향을 줄 수 있습니다.'] : undefined,
    };
  } catch (e) {
    return { success: false, columns: [], rows: [], error: `JSON 파싱 오류: ${(e as Error).message}` };
  }
}

/**
 * CSV 파싱
 */
function parseCsv(content: string, isUnreal = false): ImportResult {
  try {
    const lines = content.trim().split('\n').map(line => line.trim()).filter(Boolean);

    if (lines.length < 2) {
      return { success: false, columns: [], rows: [], error: 'CSV에 헤더와 데이터가 필요합니다.' };
    }

    // 헤더 파싱
    let headers = parseCSVLine(lines[0]);
    let dataStartIndex = 1;

    // Unreal DataTable 형식 처리 (첫 번째 열이 --- 로 시작하면 두 번째 줄이 타입)
    if (isUnreal && lines.length > 2 && lines[1].includes('---')) {
      // 타입 정보 줄 스킵
      dataStartIndex = 2;
    }

    // Unreal은 첫 컬럼이 RowName (키)
    if (isUnreal && headers[0] === '') {
      headers[0] = 'RowName';
    }

    // 컬럼 생성
    const columns: (Omit<Column, 'id'> & { id: string })[] = headers.map(header => ({
      id: uuidv4(),
      name: header,
      type: 'general' as ColumnType,
      width: header.length > 10 ? 150 : 100,
    }));

    // 행 생성
    const rows: { cells: Record<string, CellValue> }[] = [];
    const warnings: string[] = [];

    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const cells: Record<string, CellValue> = {};

      columns.forEach((col, idx) => {
        const value = values[idx];
        if (value !== undefined) {
          cells[col.id] = convertValue(value);
        }
      });

      rows.push({ cells });
    }

    // 타입 추론 - 수식이 포함된 경우만 formula로 설정
    columns.forEach((col, idx) => {
      const sampleValues = rows.slice(0, 10).map(r => r.cells[col.id]).filter(v => v !== null && v !== undefined);
      if (sampleValues.some(v => typeof v === 'string' && String(v).startsWith('='))) {
        col.type = 'formula' as ColumnType;
      }
    });

    if (rows.length > 1000) {
      warnings.push('대용량 데이터입니다. 성능에 영향을 줄 수 있습니다.');
    }

    return {
      success: true,
      columns: columns.map(({ id, ...rest }) => rest),
      rows,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (e) {
    return { success: false, columns: [], rows: [], error: `CSV 파싱 오류: ${(e as Error).message}` };
  }
}

/**
 * Unity C# 클래스 파싱
 * public/private 필드와 [SerializeField] 속성 파싱
 */
function parseCSharp(content: string): ImportResult {
  try {
    const fields: { name: string; type: string; defaultValue: string | null }[] = [];

    // 클래스명 추출
    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Unknown';

    // 필드 패턴들
    // public int health = 100;
    // [SerializeField] private float speed = 5.0f;
    // public string name;
    const fieldPatterns = [
      // public/protected 필드
      /(?:public|protected)\s+(\w+(?:<[\w,\s]+>)?)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;/g,
      // [SerializeField] private 필드
      /\[SerializeField\]\s*(?:private|protected)?\s*(\w+(?:<[\w,\s]+>)?)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;/g,
    ];

    for (const pattern of fieldPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, type, name, defaultValue] = match;
        // 중복 방지
        if (!fields.some(f => f.name === name)) {
          fields.push({
            name,
            type,
            defaultValue: defaultValue ? defaultValue.trim().replace(/[fF]$/, '') : null,
          });
        }
      }
    }

    if (fields.length === 0) {
      return { success: false, columns: [], rows: [], error: '파싱 가능한 필드를 찾지 못했습니다.' };
    }

    // 컬럼 생성 (필드명, 타입, 기본값)
    const columns: Omit<Column, 'id'>[] = [
      { name: '필드명', type: 'general', width: 120 },
      { name: '타입', type: 'general', width: 100 },
      { name: '기본값', type: 'general', width: 100 },
    ];

    const columnIds = columns.map(() => uuidv4());

    // 행 생성
    const rows = fields.map(field => ({
      cells: {
        [columnIds[0]]: field.name,
        [columnIds[1]]: field.type,
        [columnIds[2]]: field.defaultValue !== null ? convertValue(field.defaultValue) : null,
      },
    }));

    return {
      success: true,
      columns,
      rows,
      warnings: [`클래스 '${className}'에서 ${fields.length}개 필드를 파싱했습니다.`],
    };
  } catch (e) {
    return { success: false, columns: [], rows: [], error: `C# 파싱 오류: ${(e as Error).message}` };
  }
}

/**
 * Godot GDScript 파싱
 * export var, var 변수 파싱
 */
function parseGDScript(content: string): ImportResult {
  try {
    const fields: { name: string; type: string; defaultValue: string | null; exported: boolean }[] = [];

    // 클래스명 추출 (class_name 또는 파일명)
    const classMatch = content.match(/class_name\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Script';

    // 변수 패턴들
    // @export var health: int = 100
    // @export var speed := 5.0
    // var name: String = "Player"
    // export var damage = 10  (Godot 3.x)
    const patterns = [
      // Godot 4.x: @export var name: Type = value
      /@export\s+var\s+(\w+)\s*(?::\s*(\w+))?\s*(?::?=\s*([^\n]+))?/g,
      // Godot 3.x: export var name = value
      /export\s+var\s+(\w+)\s*(?::\s*(\w+))?\s*(?:=\s*([^\n]+))?/g,
      // 일반 var
      /^var\s+(\w+)\s*(?::\s*(\w+))?\s*(?::?=\s*([^\n]+))?/gm,
    ];

    const processedNames = new Set<string>();

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const isExport = i < 2;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, name, type, defaultValue] = match;
        if (!processedNames.has(name)) {
          processedNames.add(name);
          fields.push({
            name,
            type: type || inferGDType(defaultValue),
            defaultValue: defaultValue ? defaultValue.trim() : null,
            exported: isExport,
          });
        }
      }
    }

    if (fields.length === 0) {
      return { success: false, columns: [], rows: [], error: '파싱 가능한 변수를 찾지 못했습니다.' };
    }

    // 컬럼 생성
    const columns: Omit<Column, 'id'>[] = [
      { name: '변수명', type: 'general', width: 120 },
      { name: '타입', type: 'general', width: 80 },
      { name: '기본값', type: 'general', width: 100 },
      { name: 'Export', type: 'general', width: 70 },
    ];

    const columnIds = columns.map(() => uuidv4());

    // 행 생성
    const rows = fields.map(field => ({
      cells: {
        [columnIds[0]]: field.name,
        [columnIds[1]]: field.type,
        [columnIds[2]]: field.defaultValue !== null ? convertValue(field.defaultValue) : null,
        [columnIds[3]]: field.exported ? 'Yes' : 'No',
      },
    }));

    return {
      success: true,
      columns,
      rows,
      warnings: [`'${className}'에서 ${fields.length}개 변수를 파싱했습니다.`],
    };
  } catch (e) {
    return { success: false, columns: [], rows: [], error: `GDScript 파싱 오류: ${(e as Error).message}` };
  }
}

/**
 * GDScript 타입 추론
 */
function inferGDType(value: string | undefined): string {
  if (!value) return 'Variant';
  const v = value.trim();
  if (/^-?\d+$/.test(v)) return 'int';
  if (/^-?\d*\.\d+$/.test(v)) return 'float';
  if (v === 'true' || v === 'false') return 'bool';
  if (v.startsWith('"') || v.startsWith("'")) return 'String';
  if (v.startsWith('Vector2')) return 'Vector2';
  if (v.startsWith('Vector3')) return 'Vector3';
  if (v.startsWith('[')) return 'Array';
  if (v.startsWith('{')) return 'Dictionary';
  return 'Variant';
}

/**
 * Unreal C++ Header 파싱
 * UPROPERTY 매크로가 있는 필드 파싱
 */
function parseUnrealHeader(content: string): ImportResult {
  try {
    const fields: { name: string; type: string; category: string; defaultValue: string | null }[] = [];

    // 클래스명 추출
    const classMatch = content.match(/class\s+\w+_API\s+(\w+)|class\s+(\w+)\s*:/);
    const className = classMatch ? (classMatch[1] || classMatch[2]) : 'Unknown';

    // UPROPERTY 패턴
    // UPROPERTY(EditAnywhere, Category = "Stats")
    // int32 Health = 100;
    const upropertyPattern = /UPROPERTY\s*\(([^)]*)\)\s*\n?\s*(\w+(?:<[\w,\s*]+>)?)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;/g;

    let match;
    while ((match = upropertyPattern.exec(content)) !== null) {
      const [, specifiers, type, name, defaultValue] = match;

      // Category 추출
      const categoryMatch = specifiers.match(/Category\s*=\s*"([^"]+)"/);
      const category = categoryMatch ? categoryMatch[1] : '';

      fields.push({
        name,
        type,
        category,
        defaultValue: defaultValue ? defaultValue.trim().replace(/[fF]$/, '') : null,
      });
    }

    if (fields.length === 0) {
      return { success: false, columns: [], rows: [], error: 'UPROPERTY 필드를 찾지 못했습니다.' };
    }

    // 컬럼 생성
    const columns: Omit<Column, 'id'>[] = [
      { name: '필드명', type: 'general', width: 120 },
      { name: '타입', type: 'general', width: 120 },
      { name: 'Category', type: 'general', width: 100 },
      { name: '기본값', type: 'general', width: 100 },
    ];

    const columnIds = columns.map(() => uuidv4());

    // 행 생성
    const rows = fields.map(field => ({
      cells: {
        [columnIds[0]]: field.name,
        [columnIds[1]]: field.type,
        [columnIds[2]]: field.category,
        [columnIds[3]]: field.defaultValue !== null ? convertValue(field.defaultValue) : null,
      },
    }));

    return {
      success: true,
      columns,
      rows,
      warnings: [`클래스 '${className}'에서 ${fields.length}개 UPROPERTY를 파싱했습니다.`],
    };
  } catch (e) {
    return { success: false, columns: [], rows: [], error: `Header 파싱 오류: ${(e as Error).message}` };
  }
}

/**
 * CSV 라인 파싱 (따옴표 처리)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * 컬럼 타입 추론
 */
function inferColumnType(items: Record<string, unknown>[], key: string): ColumnType {
  const values = items.map(item => item[key]).filter(v => v !== null && v !== undefined);

  if (values.length === 0) return 'general';

  // 수식 감지
  const hasFormulas = values.some(v => typeof v === 'string' && v.startsWith('='));
  if (hasFormulas) return 'formula';

  // ColumnType은 'general' | 'formula'만 지원하므로 숫자도 general로
  return 'general';
}

/**
 * 값 변환
 */
function convertValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    // 숫자 문자열 변환
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }
    return value;
  }
  // 객체나 배열은 JSON 문자열로
  return JSON.stringify(value);
}

/**
 * 파일 내용을 Import
 */
export function importFromGameEngine(
  content: string,
  format: ImportFormat
): ImportResult {
  switch (format) {
    case 'json':
    case 'unity_json':
      return parseJsonArray(content);
    case 'csv':
      return parseCsv(content, false);
    case 'unreal_csv':
      return parseCsv(content, true);
    case 'unity_cs':
      return parseCSharp(content);
    case 'godot_gd':
      return parseGDScript(content);
    case 'unreal_h':
      return parseUnrealHeader(content);
    default:
      return { success: false, columns: [], rows: [], error: '지원하지 않는 형식입니다.' };
  }
}

/**
 * 파일 확장자로 형식 추론
 */
export function detectFormat(filename: string, content: string): ImportFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'json') {
    try {
      const data = JSON.parse(content);
      if (data.items && Array.isArray(data.items)) {
        return 'unity_json';
      }
    } catch {
      // 파싱 실패
    }
    return 'json';
  }

  if (ext === 'csv') {
    // Unreal DataTable 감지 (첫 줄이 비어있거나 두 번째 줄에 --- 포함)
    const lines = content.split('\n');
    if (lines.length > 1 && lines[1].includes('---')) {
      return 'unreal_csv';
    }
    return 'csv';
  }

  if (ext === 'cs') {
    return 'unity_cs';
  }

  if (ext === 'gd') {
    return 'godot_gd';
  }

  if (ext === 'h') {
    // UPROPERTY가 있으면 Unreal 헤더
    if (content.includes('UPROPERTY')) {
      return 'unreal_h';
    }
    return null; // 일반 C++ 헤더는 지원하지 않음
  }

  return null;
}
