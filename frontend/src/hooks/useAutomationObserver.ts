'use client';

/**
 * 활성 자동화의 cell-changed / row-added trigger 를 Y.Doc observer 로 발동.
 *
 * 설계:
 *  - 프로젝트별 y-doc 의 sheets 변경 감지
 *  - observeDeep 로 cells Y.Map 변경 + rows Y.Array 삽입 감지
 *  - 매치되는 자동화(enabled && subtype 일치) 만 runAutomation 호출
 *  - 무한 루프 방지: 자동화 실행 중 update-cell 이 다시 trigger 되는 걸 세션 플래그로 막음
 */

import { useEffect, useRef } from 'react';
import { getProjectDoc } from '@/lib/ydoc';
import { loadAutomations, runAutomation } from '@/lib/automations';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import type { Project } from '@/types';

export function useAutomationObserver(projectId: string | null): void {
  const executingRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;

    const doc = getProjectDoc(projectId);
    const sheetsArray = doc.getArray('sheets');

    let prevRowCounts = new Map<string, number>();
    // 초기 row count 기록
    sheetsArray.toArray().forEach((sheetY) => {
      const sheet = sheetY as import('yjs').Map<unknown>;
      const sheetId = sheet.get('id') as string;
      const rows = sheet.get('rows') as import('yjs').Array<unknown> | undefined;
      prevRowCounts.set(sheetId, rows?.length ?? 0);
    });

    const handler = (events: unknown, transaction: import('yjs').Transaction) => {
      // 사용자가 유발한 변경만 처리 (observer 본인 transact 는 origin="self" 로 표시)
      if (transaction.origin === 'automation') return;
      if (executingRef.current) return;

      const state = useProjectStore.getState();
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return;

      const autos = loadAutomations(projectId).filter((a) => a.enabled);
      if (autos.length === 0) return;

      // 어느 타입의 trigger 가 발동했는지 감지 (단순화)
      // row-added: sheetsArray 하위의 rows Y.Array 길이 증가
      // cell-changed: cells Y.Map 변경 — 여기서는 구분 없이 둘 다 모두 검사
      let fireRowAdded = false;
      let fireCellChanged = false;
      // playtest 트리거 — project 의 Playtest Sessions 시트에서
      // Status 컬럼이 'running' 으로 전환 → playtest-started, 'done' → playtest-ended.
      let firePlaytestStarted = false;
      let firePlaytestEnded = false;

      for (const sheetY of sheetsArray.toArray() as import('yjs').Map<unknown>[]) {
        const sheetId = sheetY.get('id') as string;
        const rows = sheetY.get('rows') as import('yjs').Array<unknown> | undefined;
        const newLen = rows?.length ?? 0;
        const prevLen = prevRowCounts.get(sheetId) ?? 0;
        if (newLen > prevLen) fireRowAdded = true;
        prevRowCounts.set(sheetId, newLen);
      }

      // cell-changed 는 항상 가능성으로 가정
      fireCellChanged = true;

      // Playtest 트리거 — project 의 시트 중 컬럼명 'Status' 에 'running'/'done'
      // value 가 있으면 발동 (간단화 — 실제론 prev/next 비교 필요하지만 MVP).
      for (const sheet of project.sheets) {
        const statusCol = sheet.columns.find((c) =>
          c.type === 'select' && c.name.toLowerCase().includes('status')
        );
        if (!statusCol) continue;
        const hasRunning = sheet.rows.some((r) => r.cells[statusCol.id] === 'running');
        const hasDone = sheet.rows.some((r) => r.cells[statusCol.id] === 'done');
        if (hasRunning) firePlaytestStarted = true;
        if (hasDone) firePlaytestEnded = true;
      }

      const toRun = autos.filter((a) => {
        const trigger = a.nodes.find((n) => n.type === 'trigger');
        if (!trigger) return false;
        if (trigger.subtype === 'cell-changed') return fireCellChanged;
        if (trigger.subtype === 'row-added') return fireRowAdded;
        if (trigger.subtype === 'playtest-started') return firePlaytestStarted;
        if (trigger.subtype === 'playtest-ended') return firePlaytestEnded;
        return false; // manual / schedule 은 별도 경로
      });
      if (toRun.length === 0) return;

      // 실행 (직렬로, 무한 루프 방지)
      executingRef.current = true;
      (async () => {
        try {
          for (const auto of toRun) {
            await runAutomation(auto, project as Project, {
              onNotify: (msg) => toast.info(`[${auto.name}] ${msg}`),
              onUpdateCell: (sheetId, rowId, columnId, value) => {
                doc.transact(() => {
                  state.updateCell(projectId, sheetId, rowId, columnId, value as never);
                }, 'automation');
              },
            });
          }
        } catch (e) {
          console.error('[Automation] observer 실행 실패', e);
        } finally {
          executingRef.current = false;
        }
      })();
    };

    sheetsArray.observeDeep(handler);
    return () => sheetsArray.unobserveDeep(handler);
  }, [projectId]);
}
