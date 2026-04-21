'use client';

/**
 * Home 페이지 aggregation 훅 — 전체 프로젝트 가로질러 오늘의 작업 모음.
 *
 * Stage 1 기본 집계:
 *   - activeSprint: 활성 sprint row (status ≠ done)
 *   - mySprint: 내게 assigned 된 sprint row
 *   - openBugs: 활성 bug row
 *   - recentSheets: 최근 7일 편집된 시트
 *   - recentChanges: 최근 changelog entry
 *
 * current user = localStorage 'balruno:user-name' (Track 8 presence 재활용).
 * Stage 3 에서 proper auth 로 upgrade 예정.
 */

import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { detectPmSheet, isActiveRow, isAssignedTo, type PmSheetType } from '@/lib/pmSheetDetection';
import type { Sheet, Row, ChangeEntry, Project } from '@/types';

export interface PmSheetRef {
  projectId: string;
  projectName: string;
  sheet: Sheet;
  type: PmSheetType;
  statusColumnId?: string;
  assigneeColumnId?: string;
}

export interface RowWithContext {
  row: Row;
  sheet: Sheet;
  projectId: string;
  projectName: string;
  statusColumnId?: string;
  assigneeColumnId?: string;
}

export interface TodaysWork {
  /** 현재 유저 이름 (presence-based) */
  currentUser: string;
  /** 감지된 PM 시트 목록 (전체 프로젝트 가로질러) */
  pmSheets: PmSheetRef[];
  /** 활성 sprint 행 (status ≠ done) */
  activeSprint: RowWithContext[];
  /** 내게 assigned 된 sprint 행 */
  mySprint: RowWithContext[];
  /** 활성 버그 */
  openBugs: RowWithContext[];
  /** 내게 assigned 된 버그 */
  myBugs: RowWithContext[];
  /** 최근 7일 편집된 시트 (전체 프로젝트 가로질러) */
  recentSheets: Array<{ projectId: string; projectName: string; sheet: Sheet; updatedAt: number }>;
  /** 최근 changelog (전체 프로젝트, 최대 10개) */
  recentChanges: Array<{ projectId: string; projectName: string; entry: ChangeEntry }>;
  /** 프로젝트 개수 */
  projectCount: number;
}

function getCurrentUser(): string {
  if (typeof window === 'undefined') return 'local';
  return localStorage.getItem('balruno:user-name') ?? 'local';
}

export function useTodaysWork(): TodaysWork {
  const projects = useProjectStore((s) => s.projects);

  return useMemo<TodaysWork>(() => {
    const currentUser = getCurrentUser();
    const pmSheets: PmSheetRef[] = [];
    const activeSprint: RowWithContext[] = [];
    const mySprint: RowWithContext[] = [];
    const openBugs: RowWithContext[] = [];
    const myBugs: RowWithContext[] = [];
    const recentSheets: TodaysWork['recentSheets'] = [];
    const recentChanges: TodaysWork['recentChanges'] = [];

    const sevenDaysAgo = Date.now() - 7 * 86400_000;

    for (const project of projects as Project[]) {
      for (const sheet of project.sheets) {
        // 최근 편집 시트 수집
        if ((sheet.updatedAt ?? 0) >= sevenDaysAgo) {
          recentSheets.push({
            projectId: project.id,
            projectName: project.name,
            sheet,
            updatedAt: sheet.updatedAt ?? 0,
          });
        }

        // PM 시트 감지
        const pm = detectPmSheet(sheet);
        if (!pm.type) continue;

        pmSheets.push({
          projectId: project.id,
          projectName: project.name,
          sheet,
          type: pm.type,
          statusColumnId: pm.statusColumnId,
          assigneeColumnId: pm.assigneeColumnId,
        });

        // Row aggregation — sprint / bug 만
        if (pm.type === 'sprint' || pm.type === 'generic-pm') {
          for (const row of sheet.rows) {
            if (!isActiveRow(row, pm.statusColumnId)) continue;
            const ctx: RowWithContext = {
              row,
              sheet,
              projectId: project.id,
              projectName: project.name,
              statusColumnId: pm.statusColumnId,
              assigneeColumnId: pm.assigneeColumnId,
            };
            activeSprint.push(ctx);
            if (isAssignedTo(row, pm.assigneeColumnId, currentUser)) {
              mySprint.push(ctx);
            }
          }
        }

        if (pm.type === 'bug') {
          for (const row of sheet.rows) {
            if (!isActiveRow(row, pm.statusColumnId)) continue;
            const ctx: RowWithContext = {
              row,
              sheet,
              projectId: project.id,
              projectName: project.name,
              statusColumnId: pm.statusColumnId,
              assigneeColumnId: pm.assigneeColumnId,
            };
            openBugs.push(ctx);
            if (isAssignedTo(row, pm.assigneeColumnId, currentUser)) {
              myBugs.push(ctx);
            }
          }
        }
      }

      // Changelog aggregation
      for (const entry of project.changelog ?? []) {
        recentChanges.push({
          projectId: project.id,
          projectName: project.name,
          entry,
        });
      }
    }

    // 정렬
    recentSheets.sort((a, b) => b.updatedAt - a.updatedAt);
    recentChanges.sort((a, b) => b.entry.timestamp - a.entry.timestamp);

    return {
      currentUser,
      pmSheets,
      activeSprint,
      mySprint,
      openBugs,
      myBugs,
      recentSheets: recentSheets.slice(0, 10),
      recentChanges: recentChanges.slice(0, 10),
      projectCount: projects.length,
    };
  }, [projects]);
}
