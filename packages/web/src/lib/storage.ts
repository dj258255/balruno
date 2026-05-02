import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project, StorageMetadata } from '@/types';

const DB_NAME = 'balruno';
const DB_VERSION = 1;

interface BalrunoDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': number };
  };
  metadata: {
    key: string;
    value: StorageMetadata;
  };
  backups: {
    key: number;
    value: {
      timestamp: number;
      projects: Project[];
    };
  };
}

let db: IDBPDatabase<BalrunoDB> | null = null;

// DB 초기화
async function initDB(): Promise<IDBPDatabase<BalrunoDB>> {
  if (db) return db;

  db = await openDB<BalrunoDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Projects 스토어
      if (!database.objectStoreNames.contains('projects')) {
        const projectStore = database.createObjectStore('projects', {
          keyPath: 'id',
        });
        projectStore.createIndex('by-updated', 'updatedAt');
      }

      // Metadata 스토어
      if (!database.objectStoreNames.contains('metadata')) {
        database.createObjectStore('metadata');
      }

      // Backups 스토어
      if (!database.objectStoreNames.contains('backups')) {
        database.createObjectStore('backups', {
          keyPath: 'timestamp',
        });
      }
    },
  });

  return db;
}

/**
 * 과거 버전 (9자 random id) 으로 저장된 프로젝트들의 중복 sheet/column/row id 자동 수복.
 * 로드 시점에 검사 → 중복 발견 시 uuid 재발급 + cells/cellStyles/cellMemos 키 remap.
 * project.id 자체 중복은 다른 프로젝트이므로 그쪽 id 만 재발급.
 */
function migrateDuplicateIds(projects: Project[]): { projects: Project[]; changed: boolean } {
  // uuid v4 dynamic import — 초기 로드 경로에 무거운 import 회피
  // (storage.ts 는 이미 uuid 사용 가능)
  const { v4: uuidv4 } = require('uuid') as typeof import('uuid');
  let changed = false;

  const seenProjectIds = new Set<string>();
  const normalizedProjects = projects.map((project) => {
    let nextProject = project;
    if (seenProjectIds.has(project.id)) {
      nextProject = { ...project, id: uuidv4() };
      changed = true;
    }
    seenProjectIds.add(nextProject.id);

    // 시트 중복 → DROP (이전엔 rename 이었으나 고스트 시트가 리프레시마다 "정식"
    // 으로 승격돼 계속 늘어나는 버그 발생. 같은 id 가 두 번 이상 나오면 첫 번째만 유지).
    const seenSheetIds = new Set<string>();
    const sheetsFixed = nextProject.sheets
      .filter((sheet) => {
        if (seenSheetIds.has(sheet.id)) {
          changed = true;
          return false;
        }
        seenSheetIds.add(sheet.id);
        return true;
      })
      .map((sheet) => {
      // 컬럼 id 중복 — 같은 시트 내에서만 검사
      const colIdMap: Record<string, string> = {};
      const seenColIds = new Set<string>();
      const columnsFixed = sheet.columns.map((col) => {
        if (seenColIds.has(col.id)) {
          const newId = uuidv4();
          colIdMap[col.id] = newId;
          changed = true;
          seenColIds.add(newId);
          return { ...col, id: newId };
        }
        seenColIds.add(col.id);
        return col;
      });

      // Row id 중복 → DROP (시트와 동일한 이유로 rename 에서 변경)
      const seenRowIds = new Set<string>();
      const rowsFixed = sheet.rows
        .filter((row) => {
          if (seenRowIds.has(row.id)) {
            changed = true;
            return false;
          }
          seenRowIds.add(row.id);
          return true;
        })
        .map((row) => {
          if (Object.keys(colIdMap).length === 0) return row;

          const remap = <T,>(src: Record<string, T> | undefined): Record<string, T> | undefined => {
            if (!src) return src;
            const out: Record<string, T> = {};
            for (const [k, v] of Object.entries(src)) {
              out[colIdMap[k] ?? k] = v;
            }
            return out;
          };
          return {
            ...row,
            cells: remap(row.cells) ?? {},
            cellStyles: remap(row.cellStyles),
            cellMemos: remap(row.cellMemos),
          };
        });

      return { ...sheet, columns: columnsFixed, rows: rowsFixed };
    });

    return { ...nextProject, sheets: sheetsFixed };
  });

  return { projects: normalizedProjects, changed };
}

// 모든 프로젝트 로드 — 중복 id 자동 마이그레이션 포함
export async function loadProjects(): Promise<Project[]> {
  const database = await initDB();
  const raw = await database.getAll('projects');

  const { projects, changed } = migrateDuplicateIds(raw);
  if (changed) {
    console.log('[storage] 중복 id 감지 → 자동 마이그레이션 완료');
    // 조용히 재저장 — 사용자 눈에 띄지 않도록 비동기
    const tx = database.transaction('projects', 'readwrite');
    await Promise.all([
      ...projects.map((p) => tx.store.put(p)),
      tx.done,
    ]);
  }
  return projects;
}

// 모든 프로젝트 저장 (sync - DB에 있지만 projects에 없는 것은 삭제)
export async function saveAllProjects(projects: Project[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('projects', 'readwrite');

  // 현재 DB에 있는 모든 프로젝트 ID 가져오기
  const existingKeys = await tx.store.getAllKeys();
  const projectIds = new Set(projects.map(p => p.id));

  // DB에는 있지만 현재 projects에 없는 것들 삭제
  const deletePromises = existingKeys
    .filter(key => !projectIds.has(key))
    .map(key => tx.store.delete(key));

  // 현재 projects 저장
  const putPromises = projects.map(project => tx.store.put(project));

  await Promise.all([...deletePromises, ...putPromises, tx.done]);
  await updateMetadata({ lastSaved: Date.now() });
}

// 프로젝트 삭제
export async function deleteProjectFromDB(projectId: string): Promise<void> {
  const database = await initDB();
  await database.delete('projects', projectId);
}

// 메타데이터 업데이트 (내부 saveAllProjects/createBackup 만 호출)
async function updateMetadata(updates: Partial<StorageMetadata>): Promise<void> {
  const database = await initDB();
  const current = await database.get('metadata', 'main');
  const newMetadata: StorageMetadata = {
    lastSaved: current?.lastSaved || Date.now(),
    lastBackup: current?.lastBackup || 0,
    version: '0.1.0',
    ...updates,
  };
  await database.put('metadata', newMetadata, 'main');
}

// 백업 생성 (saveProject 자동 백업 전용 — 외부 호출 없음)
async function createBackup(projects: Project[]): Promise<void> {
  const database = await initDB();
  const timestamp = Date.now();

  // 백업 저장
  await database.put('backups', { timestamp, projects });

  // 오래된 백업 삭제 (최근 10개만 유지)
  const allBackups = await database.getAllKeys('backups');
  if (allBackups.length > 10) {
    const toDelete = allBackups.slice(0, allBackups.length - 10);
    const tx = database.transaction('backups', 'readwrite');
    await Promise.all([
      ...toDelete.map((key) => tx.store.delete(key)),
      tx.done,
    ]);
  }

  await updateMetadata({ lastBackup: timestamp });
}

// JSON 파일로 내보내기
export function exportToJSON(projects: Project[]): string {
  return JSON.stringify(
    {
      version: '0.1.0',
      exportedAt: Date.now(),
      projects,
    },
    null,
    2
  );
}

// JSON 파일에서 가져오기
export function importFromJSON(jsonString: string): Project[] {
  try {
    const data = JSON.parse(jsonString);
    if (data.projects && Array.isArray(data.projects)) {
      return data.projects;
    }
    // 단일 프로젝트인 경우
    if (data.id && data.sheets) {
      return [data];
    }
    throw new Error('유효하지 않은 파일 형식');
  } catch {
    throw new Error('파일을 파싱할 수 없습니다');
  }
}

// CSV로 시트 내보내기
export function exportSheetToCSV(
  sheet: { columns: { name: string; id: string }[]; rows: { cells: Record<string, unknown> }[] }
): string {
  const headers = sheet.columns.map((col) => col.name);
  const rows = sheet.rows.map((row) =>
    sheet.columns.map((col) => {
      const value = row.cells[col.id];
      if (value === null || value === undefined) return '';
      // CSV 이스케이프
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
  );

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// CSV를 시트 데이터로 변환
export function importSheetFromCSV(csv: string): {
  columns: { name: string; type: 'general' | 'formula' }[];
  rows: { cells: Record<string, unknown> }[];
} {
  const lines = csv.trim().split('\n').map(line => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  // CSV 라인 파싱 (따옴표 처리)
  const parseCSVLine = (line: string): string[] => {
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
  };

  // 헤더 파싱
  const headers = parseCSVLine(lines[0]);

  // 컬럼 생성 (임시 ID 사용)
  const columns = headers.map((name, idx) => ({
    name: name || `Column${idx + 1}`,
    type: 'general' as const,
    _tempId: `col_${idx}`,
  }));

  // 행 생성
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const cells: Record<string, unknown> = {};

    columns.forEach((col, idx) => {
      const value = values[idx];
      if (value !== undefined && value !== '') {
        // 숫자 변환 시도
        const num = Number(value);
        cells[col._tempId] = !isNaN(num) && value !== '' ? num : value;
      }
    });

    rows.push({ cells });
  }

  return {
    columns: columns.map(({ _tempId, ...rest }) => rest),
    rows,
  };
}

// 자동 저장 설정
let autoSaveInterval: NodeJS.Timeout | null = null;

export function startAutoSave(
  getProjects: () => Project[],
  onSave?: () => void,
  intervalMs: number = 30000
): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  autoSaveInterval = setInterval(async () => {
    const projects = getProjects();
    if (projects.length > 0) {
      await saveAllProjects(projects);
      onSave?.();
    }
  }, intervalMs);
}

export function stopAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// 자동 백업 설정 (5분마다)
let autoBackupInterval: NodeJS.Timeout | null = null;

export function startAutoBackup(
  getProjects: () => Project[],
  onBackup?: () => void,
  intervalMs: number = 300000
): void {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }

  autoBackupInterval = setInterval(async () => {
    const projects = getProjects();
    if (projects.length > 0) {
      await createBackup(projects);
      onBackup?.();
    }
  }, intervalMs);
}

export function stopAutoBackup(): void {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}
