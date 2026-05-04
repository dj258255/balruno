/**
 * useEconomyDesign — 시트당 단일 economy automation 의 read/write 훅.
 *
 * 역할:
 *  - mode='economy' automation 을 시트 이름으로 매칭해 로드
 *  - 없으면 createBlankEconomy 로 신규 생성 (default Faucet/Sink 와 매핑되는 노드 동봉)
 *  - legacy mode='flow' automation 발견 시 economy 로 1회 마이그레이션
 *  - Faucet/Sink CRUD 시 다이어그램 노드 자동 동기 (origin='faucet'/'sink' 매칭)
 *  - 분석 탭 / 다이어그램 탭이 같은 EconomyDesignData + nodes 를 공유
 *
 * 동기 규칙:
 *  - Faucet 추가 → origin='faucet' Source 노드 자동 생성
 *  - Faucet 수정 (rate/name) → 매칭 Source 노드 config 업데이트
 *  - Faucet 삭제 → 매칭 Source 노드 + 그 노드 연결 edge 삭제
 *  - Source 노드를 다이어그램에서 직접 추가하면 origin='manual' (Faucet 영향 안 받음)
 *  - Sink 도 동일 패턴
 */

import { useCallback, useEffect, useState } from 'react';
import {
  loadAutomations,
  saveAutomations,
  createBlankEconomy,
  migrateFlowToEconomy,
  addFaucetToDesign,
  updateFaucetInDesign,
  deleteFaucetFromDesign,
  addSinkToDesign,
  updateSinkInDesign,
  deleteSinkFromDesign,
  type Automation,
  type EconomyDesignData,
} from '@/lib/automations';
import type {
  Faucet,
  Sink,
  EconomyConfig,
  SinglePlayerSource,
  SinglePlayerSink,
  SinglePlayerConfig,
} from '@/lib/economySimulator';

export interface EconomyDesignHandle {
  automation: Automation;
  economy: EconomyDesignData;
  // 분석 탭 액션 — 동기 처리 자동 수행
  setConfig: (next: EconomyConfig) => void;
  setGameMode: (mode: 'online' | 'single') => void;
  addFaucet: (f: Faucet) => void;
  updateFaucet: (id: string, patch: Partial<Faucet>) => void;
  deleteFaucet: (id: string) => void;
  addSink: (s: Sink) => void;
  updateSink: (id: string, patch: Partial<Sink>) => void;
  deleteSink: (id: string) => void;
  // single player
  setSingleConfig: (next: SinglePlayerConfig) => void;
  addSingleSource: (s: SinglePlayerSource) => void;
  updateSingleSource: (id: string, patch: Partial<SinglePlayerSource>) => void;
  deleteSingleSource: (id: string) => void;
  addSingleSink: (s: SinglePlayerSink) => void;
  updateSingleSink: (id: string, patch: Partial<SinglePlayerSink>) => void;
  deleteSingleSink: (id: string) => void;
  // 다이어그램 탭 액션 — 직접 nodes/edges 조작 (sync 영향 없음)
  updateAutomation: (updater: (a: Automation) => Automation) => void;
}

export function useEconomyDesign(
  projectId: string | null,
  sheetName: string | null,
): EconomyDesignHandle | null {
  const [automation, setAutomation] = useState<Automation | null>(null);

  // 로드 / 마이그레이션 / 첫 생성
  useEffect(() => {
    if (!projectId || !sheetName) {
      setAutomation(null);
      return;
    }
    const targetName = `Economy: ${sheetName}`;
    const all = loadAutomations(projectId);
    let match = all.find((a) => a.name === targetName && a.mode === 'economy');
    if (match) {
      setAutomation(match);
      return;
    }
    // legacy mode='flow' 가 같은 이름이면 마이그레이션
    const legacy = all.find((a) => a.name === targetName && a.mode === 'flow');
    if (legacy) {
      const migrated = migrateFlowToEconomy(legacy);
      const next = all.map((a) => (a.id === legacy.id ? migrated : a));
      saveAutomations(projectId, next);
      setAutomation(migrated);
      return;
    }
    // 없으면 신규 생성
    match = createBlankEconomy(targetName);
    saveAutomations(projectId, [...all, match]);
    setAutomation(match);
  }, [projectId, sheetName]);

  const persist = useCallback(
    (next: Automation) => {
      if (!projectId) return;
      const all = loadAutomations(projectId);
      const idx = all.findIndex((a) => a.id === next.id);
      const list = idx >= 0 ? all.map((a) => (a.id === next.id ? next : a)) : [...all, next];
      saveAutomations(projectId, list);
      setAutomation(next);
    },
    [projectId],
  );

  const updateEconomy = useCallback(
    (patch: Partial<EconomyDesignData>) => {
      if (!automation || !automation.economy) return;
      persist({
        ...automation,
        economy: { ...automation.economy, ...patch },
        updatedAt: Date.now(),
      });
    },
    [automation, persist],
  );

  const updateAutomation = useCallback(
    (updater: (a: Automation) => Automation) => {
      if (!automation) return;
      persist(updater(automation));
    },
    [automation, persist],
  );

  // -------- 분석 탭 액션 (동기 자동 수행) — 순수 헬퍼 호출 + persist --------

  if (!automation || !automation.economy) return null;
  const economy = automation.economy;

  const handle: EconomyDesignHandle = {
    automation,
    economy,
    setConfig: (next) => updateEconomy({ config: next }),
    setGameMode: (mode) => updateEconomy({ gameMode: mode }),

    addFaucet: (f) => persist(addFaucetToDesign(automation, f)),
    updateFaucet: (id, patch) => persist(updateFaucetInDesign(automation, id, patch)),
    deleteFaucet: (id) => persist(deleteFaucetFromDesign(automation, id)),

    addSink: (s) => persist(addSinkToDesign(automation, s)),
    updateSink: (id, patch) => persist(updateSinkInDesign(automation, id, patch)),
    deleteSink: (id) => persist(deleteSinkFromDesign(automation, id)),

    setSingleConfig: (next) => updateEconomy({ singleConfig: next }),
    addSingleSource: (s) => updateEconomy({ singleSources: [...(economy.singleSources ?? []), s] }),
    updateSingleSource: (id, patch) =>
      updateEconomy({
        singleSources: (economy.singleSources ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }),
    deleteSingleSource: (id) =>
      updateEconomy({
        singleSources: (economy.singleSources ?? []).filter((s) => s.id !== id),
      }),
    addSingleSink: (s) => updateEconomy({ singleSinks: [...(economy.singleSinks ?? []), s] }),
    updateSingleSink: (id, patch) =>
      updateEconomy({
        singleSinks: (economy.singleSinks ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }),
    deleteSingleSink: (id) =>
      updateEconomy({
        singleSinks: (economy.singleSinks ?? []).filter((s) => s.id !== id),
      }),

    updateAutomation,
  };

  return handle;
}
