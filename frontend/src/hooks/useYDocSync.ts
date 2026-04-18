'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  getProjectDoc,
  hydrateDocFromProject,
  observeProjectDoc,
  detachDoc,
} from '@/lib/ydoc';

/**
 * Y.Doc ↔ Zustand 단방향 브릿지 (Track 0 Phase 1).
 *
 * 동작:
 *  - `projects` 가 로드되면 각 프로젝트마다 Y.Doc hydrate (in-memory only)
 *  - Y.Doc 변경(update 이벤트) → `docToProject` → Zustand setState
 *  - 프로젝트 삭제 → observer 해제 + Y.Doc 폐기
 *
 * Phase 1 특성:
 *  - y-indexeddb persist 비활성 (매 세션 storage.ts projects 로부터 rehydrate)
 *  - Y.Doc 은 "쓰기 경로용 중간 레이어" — 진실의 소스는 여전히 Zustand/storage.ts
 *
 * Phase 2 (모든 write 액션 Y.Doc 이관 후):
 *  - y-indexeddb persist 활성 → Y.Doc 이 진실의 소스
 *  - storage.ts 는 백업/export 용도로만 유지
 */
export function useYDocSync(): void {
  const projects = useProjectStore((s) => s.projects);

  // 현재 관리중인 Y.Doc 프로젝트 ID → unobserve 함수
  const observersRef = useRef<Map<string, () => void>>(new Map());
  const hydratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(projects.map((p) => p.id));

    // 제거된 프로젝트: observer 해제 + Y.Doc 폐기
    for (const [id, unobserve] of observersRef.current.entries()) {
      if (!currentIds.has(id)) {
        unobserve();
        observersRef.current.delete(id);
        hydratedRef.current.delete(id);
        detachDoc(id);
      }
    }

    // 신규 프로젝트: hydrate 후 observer 등록 순서 중요 —
    // observer 를 hydrate 전에 걸면 초기 hydrate 전체가 observer 이벤트로 돌아와
    // setState 루프를 유발함.
    for (const project of projects) {
      if (hydratedRef.current.has(project.id)) continue;

      const doc = getProjectDoc(project.id);
      hydrateDocFromProject(doc, project);
      hydratedRef.current.add(project.id);

      const unobserve = observeProjectDoc(doc, (updated) => {
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) =>
            p.id === updated.id ? updated : p
          ),
        }));
      });
      observersRef.current.set(project.id, unobserve);
    }
  }, [projects]);

  // 언마운트 시 모든 observer 해제
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
