'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  getProjectDoc,
  initializeProjectDoc,
  observeProjectDoc,
  docToProject,
  detachDoc,
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
 * 루프 방지:
 *  - observer 는 Y.Doc → Zustand 단방향. 자기 자신을 재진입시키지 않음.
 *  - `observersRef` 가 프로젝트별 등록 상태 추적 → 중복 observer 방지.
 */
export function useYDocSync(): void {
  const projects = useProjectStore((s) => s.projects);

  const observersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const currentIds = new Set(projects.map((p) => p.id));

    // 제거된 프로젝트 정리
    for (const [id, unobserve] of observersRef.current.entries()) {
      if (!currentIds.has(id)) {
        unobserve();
        observersRef.current.delete(id);
        detachDoc(id);
      }
    }

    // 새 프로젝트: y-indexeddb persist → hydrate(필요 시) → observer → 초기 sync
    (async () => {
      for (const project of projects) {
        if (observersRef.current.has(project.id)) continue;

        await initializeProjectDoc(project);
        if (cancelled) return;

        const doc = getProjectDoc(project.id);

        const unobserve = observeProjectDoc(doc, (updated) => {
          useProjectStore.setState((state) => ({
            projects: state.projects.map((p) =>
              p.id === updated.id ? updated : p
            ),
          }));
        });
        observersRef.current.set(project.id, unobserve);

        // observer 등록 전에 발생한 write (+ y-indexeddb 에서 복원된 최신 상태)
        // 를 Zustand 에 한 번 반사.
        const current = docToProject(doc);
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) =>
            p.id === current.id ? current : p
          ),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  useEffect(() => {
    const observers = observersRef.current;
    return () => {
      for (const unobserve of observers.values()) {
        unobserve();
      }
      observers.clear();
    };
  }, []);
}
