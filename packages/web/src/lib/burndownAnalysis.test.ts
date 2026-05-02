import { describe, it, expect } from 'vitest';
import { analyzeBurndown } from './burndownAnalysis';
import type { Sheet, ChangeEntry } from '@/types';

function makeSprintSheet(now: number): Sheet {
  // 스프린트 스타일 시트 — status + assignee + priority + points
  return {
    id: 'sheet-1',
    name: 'Sprint 42',
    columns: [
      { id: 'c-title', name: 'Title', type: 'general' },
      { id: 'c-status', name: 'Status', type: 'select' },
      { id: 'c-assignee', name: 'Assignee', type: 'general' },
      { id: 'c-priority', name: 'Priority', type: 'select' },
      { id: 'c-points', name: 'Points', type: 'general' },
      { id: 'c-start', name: 'Start Date', type: 'date' },
      { id: 'c-end', name: 'End Date', type: 'date' },
    ],
    rows: [
      {
        id: 'r-1',
        cells: {
          'c-title': 'Task A',
          'c-status': 'done',
          'c-assignee': '범수',
          'c-priority': 'high',
          'c-points': 5,
          'c-start': new Date(now - 6 * 86400000).toISOString().slice(0, 10),
          'c-end': new Date(now + 4 * 86400000).toISOString().slice(0, 10),
        },
      },
      {
        id: 'r-2',
        cells: {
          'c-title': 'Task B',
          'c-status': 'in-progress',
          'c-assignee': '범수',
          'c-priority': 'medium',
          'c-points': 3,
          'c-start': new Date(now - 6 * 86400000).toISOString().slice(0, 10),
          'c-end': new Date(now + 4 * 86400000).toISOString().slice(0, 10),
        },
      },
      {
        id: 'r-3',
        cells: {
          'c-title': 'Task C',
          'c-status': 'todo',
          'c-assignee': '범수',
          'c-priority': 'low',
          'c-points': 2,
          'c-start': new Date(now - 6 * 86400000).toISOString().slice(0, 10),
          'c-end': new Date(now + 4 * 86400000).toISOString().slice(0, 10),
        },
      },
    ],
    createdAt: now - 7 * 86400000,
    updatedAt: now,
  };
}

describe('analyzeBurndown', () => {
  it('PM 시트가 아니면 eligible=false', () => {
    const sheet: Sheet = {
      id: 's',
      name: 'Characters',
      columns: [{ id: 'c1', name: 'HP', type: 'general' }],
      rows: [],
      createdAt: 0,
      updatedAt: 0,
    };
    const result = analyzeBurndown({ sheet, changelog: [] });
    expect(result.eligible).toBe(false);
  });

  it('스프린트 시트에서 총 points 와 completed points 계산', () => {
    const now = Date.now();
    const sheet = makeSprintSheet(now);
    const result = analyzeBurndown({ sheet, changelog: [] });
    expect(result.eligible).toBe(true);
    expect(result.unit).toBe('points');
    // 5 + 3 + 2 = 10
    expect(result.totalStart).toBe(10);
    // done 은 Task A 뿐 → 5
    expect(result.completed).toBe(5);
  });

  it('count 단위 모드에서는 row 당 1씩 집계', () => {
    const now = Date.now();
    const sheet = makeSprintSheet(now);
    const result = analyzeBurndown({ sheet, changelog: [], unit: 'count' });
    expect(result.totalStart).toBe(3);
    expect(result.completed).toBe(1);
  });

  it('changelog 로 done 전환 시점을 파악해 일자별 remaining 이 감소', () => {
    const now = Date.now();
    const sheet = makeSprintSheet(now);
    const threeDaysAgo = now - 3 * 86400000;
    const changelog: ChangeEntry[] = [
      {
        id: 'log-1',
        timestamp: threeDaysAgo,
        userId: 'u',
        userName: '범수',
        sheetId: 'sheet-1',
        rowId: 'r-1',
        columnId: 'c-status',
        before: 'in-progress',
        after: 'done',
      },
    ];
    const result = analyzeBurndown({ sheet, changelog });
    expect(result.eligible).toBe(true);
    // 최초 시점엔 모두 open → remaining = 10
    const first = result.points[0];
    expect(first.remaining).toBe(10);
    // 마지막 렌더된 지점(현재 또는 그 직전) → 5 (Task A 가 done)
    const lastRendered = result.points.filter((p) => Number.isFinite(p.remaining)).pop();
    expect(lastRendered?.remaining).toBe(5);
  });

  it('ideal line 은 startDate 에 totalStart 에서 endDate 에 0 으로 선형 감소', () => {
    const now = Date.now();
    const sheet = makeSprintSheet(now);
    const result = analyzeBurndown({ sheet, changelog: [] });
    expect(result.points[0].ideal).toBe(result.totalStart);
    const last = result.points[result.points.length - 1];
    expect(last.ideal).toBe(0);
  });
});
