import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  getProjectDoc,
  initializeProjectDoc,
  observeProjectDoc,
  docToProject,
  detachDoc,
  dedupeSheetsInDoc,
} from '@/lib/ydoc';

/**
 * Y.Doc ↔ Zustand 브릿지 (TrackPhase 2~4).
 *
 * 단일 책임:
 *  1. 새 프로젝트 → Y.Doc 초기화 (y-indexeddb persist + 조건부 hydrate)
 *  2. Y.Doc observer 등록 → 변경 시 Zustand `projects` 에 반사
 *  3. 제거된 프로젝트 → observer 해제 + Y.Doc/UndoManager detach
 *
 * 마이그레이션 (Phase 4):
 *  - `initializeProjectDoc` 이 y-indexeddb 에서 이전 상태 복원을 시도
 *  - 복원된 Y.Doc 이 비어있으면 storage.ts 의 projects 로 hydrate (= 자동 마이그레이션)
 *  - 플래그 체크 없이 매 세션 idempotent — `isDocHydrated` 가 이중 hydrate 방지
 *
 * StrictMode race 회피:
 *  - 과거에는 effect 본문에서 `cancelled` flag 로 unmount 후 abort 했고, 동일 effect cycle 의
 *    cleanup 에서 `observersRef` 를 비웠음. 이로 인해 strict-mode dev 더블-mount 에서 첫 효과가
 *    cleanup 된 직후 in-flight async 들이 일제히 `cancelled` 에 막혀 observer 등록 실패 →
 *    프로젝트별 setState 가 먹통이 됐다 (예: "새 문서" 클릭 후 sidebar 가 갱신 안 됨).
 *  - 새 구조: observer 는 페이지 lifetime 동안 살아있는 module-level state. async 는 abort 하지
 *    않고, 등록 직전에 `observersRef.has` race-check 만 한다. cleanup 에서 observer 를 해제하지
 *    않음 → strict-mode 재마운트가 observer 를 잃지 않음.
 */
export function useYDocSync(): void {
  const projects = useProjectStore((s) => s.projects);

  const observersRef = useRef<Map<string, () => void>>(new Map());
  // sync 진입 ID 추적 — 동일 effect cycle 또는 strict-mode 더블-mount 가 같은 프로젝트를
  // 두 번 schedule 하지 않도록.
  const scheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(projects.map((p) => p.id));

    // 제거된 프로젝트 정리
    for (const [id, unobserve] of observersRef.current.entries()) {
      if (!currentIds.has(id)) {
        unobserve();
        observersRef.current.delete(id);
        scheduledRef.current.delete(id);
        detachDoc(id);
      }
    }

    // 새 프로젝트: y-indexeddb persist → hydrate(필요 시) → observer → 초기 sync
    for (const project of projects) {
      if (scheduledRef.current.has(project.id)) continue;
      scheduledRef.current.add(project.id);

      void (async () => {
        try {
          await initializeProjectDoc(project);

          // 동일 프로젝트를 다른 cycle 이 먼저 등록했을 가능성 — race-check.
          if (observersRef.current.has(project.id)) return;

          const doc = getProjectDoc(project.id);

          // 데이터 손상 자동 복구: 같은 sheet ID 가 sheets Y.Array 에 여러 번 박혀있으면
          // updatedAt 가장 큰 인스턴스만 남기고 정리.
          const removed = dedupeSheetsInDoc(doc);
          if (removed > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[useYDocSync] 프로젝트 "${project.name}" 에서 중복 시트 ${removed}개 제거됨`,
            );
          }

          const unobserve = observeProjectDoc(doc, (updated) => {
            useProjectStore.setState((state) => ({
              projects: state.projects.map((p) =>
                p.id === updated.id ? updated : p
              ),
            }));
          });

          // observer 가 두 번 붙는 일이 절대 없도록 한 번 더 race-check.
          if (observersRef.current.has(project.id)) {
            unobserve();
            return;
          }
          observersRef.current.set(project.id, unobserve);

          // observer 등록 전에 발생한 write (+ y-indexeddb 에서 복원된 최신 상태)
          // 를 Zustand 에 한 번 반사.
          const current = docToProject(doc);
          useProjectStore.setState((state) => ({
            projects: state.projects.map((p) =>
              p.id === current.id ? current : p
            ),
          }));
        } catch (e) {
          // 실패 시 다음 cycle 에서 재시도 가능하도록 schedule lock 해제
          scheduledRef.current.delete(project.id);
          throw e;
        }
      })();
    }
  }, [projects]);
}
