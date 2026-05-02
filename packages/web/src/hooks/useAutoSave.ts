'use client';

/**
 * Auto save + auto backup 부트스트랩.
 * page.tsx 의 god component 분해 (Track D-1).
 *
 * - 30초 간격 autosave
 * - 5분 간격 자동 backup (별도 IndexedDB store)
 * - projects 변경 시 1초 디바운스 추가 저장
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { saveAllProjects, startAutoSave, stopAutoSave, startAutoBackup, stopAutoBackup } from '@/lib/storage';
import type { Project } from '@/types';

export function useAutoSave(isLoading: boolean, projects: Project[]): void {
  const setLastSaved = useProjectStore((s) => s.setLastSaved);

  useEffect(() => {
    if (!isLoading) {
      startAutoSave(
        () => useProjectStore.getState().projects,
        () => setLastSaved(Date.now()),
        30000
      );
      startAutoBackup(
        () => useProjectStore.getState().projects,
        () => console.log('Backup created'),
        300000
      );
      return () => {
        stopAutoSave();
        stopAutoBackup();
      };
    }
  }, [isLoading, setLastSaved]);

  useEffect(() => {
    if (!isLoading && projects.length > 0) {
      const timeout = setTimeout(() => {
        saveAllProjects(projects);
        setLastSaved(Date.now());
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [projects, isLoading, setLastSaved]);
}
