/**
 * Y.Doc 라운드트립 및 편집 연산 검증 — Track 0 스캐폴딩 신뢰성 확보.
 *
 * 이 테스트가 통과해야 Zustand 슬라이스를 Y.Doc 기반으로 옮길 수 있음.
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { Project } from '@/types';
import {
  getProjectDoc,
  detachDoc,
  hydrateDocFromProject,
  docToProject,
  updateCellInDoc,
  updateProjectMeta,
  isDocHydrated,
  observeProjectDoc,
} from './ydoc';

function makeSampleProject(): Project {
  return {
    id: 'proj-test',
    name: 'Test Project',
    description: '샘플 설명',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    syncMode: 'local',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Characters',
        exportClassName: 'CharacterData',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        columns: [
          { id: 'col-1', name: 'ID', type: 'general', width: 80 },
          { id: 'col-2', name: 'HP', type: 'general', width: 100 },
          { id: 'col-3', name: 'DPS', type: 'formula', formula: '=HP * 0.1', width: 120 },
        ],
        rows: [
          {
            id: 'row-1',
            cells: { 'col-1': 'CHAR_001', 'col-2': 1000, 'col-3': 100 },
            cellStyles: {
              'col-2': { bold: true, fontColor: '#ff0000' },
            },
            cellMemos: { 'col-3': '크리 반영 전 기본값' },
          },
          {
            id: 'row-2',
            cells: { 'col-1': 'CHAR_002', 'col-2': 800, 'col-3': 80 },
          },
        ],
        stickers: [
          {
            id: 'sticker-1',
            text: '2라운드에 너프',
            color: '#ffff00',
            x: 100,
            y: 200,
            width: 120,
            height: 60,
            createdAt: 1_700_000_000_000,
          },
        ],
      },
    ],
    folders: [
      {
        id: 'folder-1',
        name: 'RPG',
        color: '#3b82f6',
        isExpanded: true,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    ],
  };
}

describe('Y.Doc 라운드트립', () => {
  it('Project → Y.Doc → Project 가 동일 데이터 유지', () => {
    const doc = new Y.Doc();
    const original = makeSampleProject();

    hydrateDocFromProject(doc, original);
    const restored = docToProject(doc);

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.description).toBe(original.description);
    expect(restored.sheets).toHaveLength(1);
    expect(restored.sheets[0].columns).toHaveLength(3);
    expect(restored.sheets[0].rows).toHaveLength(2);
    expect(restored.sheets[0].rows[0].cells['col-1']).toBe('CHAR_001');
    expect(restored.sheets[0].rows[0].cells['col-2']).toBe(1000);
    expect(restored.sheets[0].rows[0].cellStyles?.['col-2']).toEqual({
      bold: true,
      fontColor: '#ff0000',
    });
    expect(restored.sheets[0].rows[0].cellMemos?.['col-3']).toBe('크리 반영 전 기본값');
    expect(restored.sheets[0].stickers).toHaveLength(1);
    expect(restored.sheets[0].stickers?.[0].text).toBe('2라운드에 너프');
    expect(restored.folders).toHaveLength(1);
    expect(restored.folders?.[0].color).toBe('#3b82f6');
  });

  it('수식 컬럼 보존', () => {
    const doc = new Y.Doc();
    hydrateDocFromProject(doc, makeSampleProject());
    const restored = docToProject(doc);

    const formulaCol = restored.sheets[0].columns.find((c) => c.id === 'col-3');
    expect(formulaCol?.type).toBe('formula');
    expect(formulaCol?.formula).toBe('=HP * 0.1');
  });

  it('빈 stickers / folders 처리', () => {
    const doc = new Y.Doc();
    const minimal: Project = {
      ...makeSampleProject(),
      folders: undefined,
      sheets: [
        {
          ...makeSampleProject().sheets[0],
          stickers: undefined,
        },
      ],
    };

    hydrateDocFromProject(doc, minimal);
    const restored = docToProject(doc);

    expect(restored.folders).toBeUndefined();
    expect(restored.sheets[0].stickers).toBeUndefined();
  });
});

describe('Y.Doc 편집 연산', () => {
  it('updateCellInDoc: 셀 값 변경 + updatedAt 갱신', () => {
    const doc = new Y.Doc();
    const original = makeSampleProject();
    hydrateDocFromProject(doc, original);

    const beforeUpdatedAt = (doc.getArray('sheets').get(0) as Y.Map<unknown>).get(
      'updatedAt'
    ) as number;

    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-2', 9999);

    const restored = docToProject(doc);
    expect(restored.sheets[0].rows[0].cells['col-2']).toBe(9999);
    expect(restored.sheets[0].updatedAt).toBeGreaterThan(beforeUpdatedAt);
  });

  it('updateProjectMeta: 이름/설명 변경', () => {
    const doc = new Y.Doc();
    hydrateDocFromProject(doc, makeSampleProject());

    updateProjectMeta(doc, { name: '새 이름', description: '새 설명' });

    const restored = docToProject(doc);
    expect(restored.name).toBe('새 이름');
    expect(restored.description).toBe('새 설명');
  });

  it('동시 편집 (두 doc 에서 다른 셀 편집) — CRDT 병합', () => {
    // 실제 협업 시나리오: 같은 프로젝트를 두 브라우저가 편집 후 sync
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    hydrateDocFromProject(docA, makeSampleProject());

    // A → B 초기 sync
    const initialState = Y.encodeStateAsUpdate(docA);
    Y.applyUpdate(docB, initialState);

    // 각자 다른 셀 편집
    updateCellInDoc(docA, 'sheet-1', 'row-1', 'col-2', 5555);
    updateCellInDoc(docB, 'sheet-1', 'row-2', 'col-2', 7777);

    // 양방향 sync
    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);
    Y.applyUpdate(docB, updateA);
    Y.applyUpdate(docA, updateB);

    // 양쪽 다 모든 편집 보유
    const restoredA = docToProject(docA);
    const restoredB = docToProject(docB);
    expect(restoredA.sheets[0].rows[0].cells['col-2']).toBe(5555);
    expect(restoredA.sheets[0].rows[1].cells['col-2']).toBe(7777);
    expect(restoredB.sheets[0].rows[0].cells['col-2']).toBe(5555);
    expect(restoredB.sheets[0].rows[1].cells['col-2']).toBe(7777);
  });
});

describe('Y.Doc 캐시', () => {
  it('getProjectDoc 동일 ID → 동일 Doc 인스턴스', () => {
    const id = 'cache-test-' + Math.random();
    const doc1 = getProjectDoc(id);
    const doc2 = getProjectDoc(id);
    expect(doc1).toBe(doc2);
    detachDoc(id);
  });

  it('detachDoc 후 새 인스턴스 반환', () => {
    const id = 'cache-test-' + Math.random();
    const doc1 = getProjectDoc(id);
    detachDoc(id);
    const doc2 = getProjectDoc(id);
    expect(doc1).not.toBe(doc2);
    detachDoc(id);
  });
});

describe('Y.Doc hydrate 상태 + observer (Track 0 Phase 1)', () => {
  it('isDocHydrated: hydrate 전/후 판정', () => {
    const doc = new Y.Doc();
    expect(isDocHydrated(doc)).toBe(false);

    hydrateDocFromProject(doc, makeSampleProject());
    expect(isDocHydrated(doc)).toBe(true);
  });

  // 디바운스된 observer — 50ms + rAF 후 flush. waitFor 로 기다림.
  const waitForCallback = () => new Promise((resolve) => setTimeout(resolve, 120));

  it('observeProjectDoc: Y.Doc write → onChange 콜백 fire', async () => {
    const doc = new Y.Doc();
    hydrateDocFromProject(doc, makeSampleProject());

    let latest: Project | null = null;
    const unobserve = observeProjectDoc(doc, (p) => {
      latest = p;
    });

    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-2', 7777);
    await waitForCallback();

    expect(latest).not.toBeNull();
    expect(latest!.sheets[0].rows[0].cells['col-2']).toBe(7777);

    unobserve();
  });

  it('observeProjectDoc: unobserve 후 콜백 fire 안 됨', async () => {
    const doc = new Y.Doc();
    hydrateDocFromProject(doc, makeSampleProject());

    let count = 0;
    const unobserve = observeProjectDoc(doc, () => {
      count++;
    });

    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-2', 111);
    await waitForCallback();
    expect(count).toBe(1);

    unobserve();
    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-2', 222);
    await waitForCallback();
    expect(count).toBe(1);
  });

  it('observeProjectDoc: hydrate 전 Y.Doc 변경은 콜백 fire 안 함', () => {
    const doc = new Y.Doc();
    let count = 0;
    observeProjectDoc(doc, () => {
      count++;
    });

    // meta.id 가 없는 상태에서 아무 write 해도 콜백 무시
    doc.transact(() => {
      doc.getMap('meta').set('random', 'value');
    });
    expect(count).toBe(0);
  });

  it('observeProjectDoc: 여러 write (동일/분리 트랜잭션) 는 디바운스로 콜백 1회만 fire', async () => {
    const doc = new Y.Doc();
    hydrateDocFromProject(doc, makeSampleProject());

    let count = 0;
    const unobserve = observeProjectDoc(doc, () => {
      count++;
    });

    // 50ms 안에 연속 write — 분리 트랜잭션이어도 디바운스로 묶임
    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-2', 10);
    updateCellInDoc(doc, 'sheet-1', 'row-2', 'col-2', 20);
    updateCellInDoc(doc, 'sheet-1', 'row-1', 'col-3', 30);
    await waitForCallback();

    expect(count).toBe(1);

    unobserve();
  });
});
