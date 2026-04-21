'use client';

/**
 * 21개 툴 패널의 show/setShow 상태를 단일 hook 으로 통합.
 * page.tsx 의 god component 분해 (Track D-1).
 *
 * - panels: Record<ToolId, { show, setShow }> — DockedToolbox/BottomDock 가 그대로 받음
 * - openByName(name): CommandPalette 의 'balruno:open-panel' 이벤트 매핑
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ToolId } from '@/config/toolGroups';

interface PanelState {
  show: boolean;
  setShow: (v: boolean) => void;
}

export function usePanelStates(): {
  panels: Record<ToolId, PanelState>;
  openByName: (name: string) => void;
} {
  const [calculator, setCalculator] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [chart, setChart] = useState(false);
  const [preset, setPreset] = useState(false);
  const [imbalance, setImbalance] = useState(false);
  const [goal, setGoal] = useState(false);
  const [balance, setBalance] = useState(false);
  const [economy, setEconomy] = useState(false);
  const [dpsVariance, setDpsVariance] = useState(false);
  const [curveFitting, setCurveFitting] = useState(false);
  const [formulaHelper, setFormulaHelper] = useState(false);
  const [balanceValidator, setBalanceValidator] = useState(false);
  const [difficultyCurve, setDifficultyCurve] = useState(false);
  const [simulation, setSimulation] = useState(false);
  const [entityDefinition, setEntityDefinition] = useState(false);
  const [autoBalancer, setAutoBalancer] = useState(false);
  const [lootSimulator, setLootSimulator] = useState(false);
  const [powerCurveCompare, setPowerCurveCompare] = useState(false);
  const [comments, setComments] = useState(false);
  const [interfaceDesigner, setInterfaceDesigner] = useState(false);
  const [automations, setAutomations] = useState(false);
  const [sensitivity, setSensitivity] = useState(false);
  const [changeHistory, setChangeHistory] = useState(false);
  const [fpsSimulation, setFpsSimulation] = useState(false);
  const [fpsTeamSimulation, setFpsTeamSimulation] = useState(false);
  const [deckSimulation, setDeckSimulation] = useState(false);
  const [frameData, setFrameData] = useState(false);
  const [aiBehavior, setAiBehavior] = useState(false);
  const [matchupMatrix, setMatchupMatrix] = useState(false);
  const [replayTimeline, setReplayTimeline] = useState(false);
  const [snapshotCompare, setSnapshotCompare] = useState(false);
  const [mobaLaning, setMobaLaning] = useState(false);
  const [rtsBuildOrder, setRtsBuildOrder] = useState(false);
  const [mmoRaid, setMmoRaid] = useState(false);
  const [autoBattler, setAutoBattler] = useState(false);
  const [hordeSurvivor, setHordeSurvivor] = useState(false);
  const [aiPlaytest, setAiPlaytest] = useState(false);
  const [formulaVerifier, setFormulaVerifier] = useState(false);

  const panels: Record<ToolId, PanelState> = useMemo(() => ({
    calculator: { show: calculator, setShow: setCalculator },
    comparison: { show: comparison, setShow: setComparison },
    chart: { show: chart, setShow: setChart },
    preset: { show: preset, setShow: setPreset },
    imbalance: { show: imbalance, setShow: setImbalance },
    goal: { show: goal, setShow: setGoal },
    balance: { show: balance, setShow: setBalance },
    economy: { show: economy, setShow: setEconomy },
    dpsVariance: { show: dpsVariance, setShow: setDpsVariance },
    curveFitting: { show: curveFitting, setShow: setCurveFitting },
    formulaHelper: { show: formulaHelper, setShow: setFormulaHelper },
    balanceValidator: { show: balanceValidator, setShow: setBalanceValidator },
    difficultyCurve: { show: difficultyCurve, setShow: setDifficultyCurve },
    simulation: { show: simulation, setShow: setSimulation },
    entityDefinition: { show: entityDefinition, setShow: setEntityDefinition },
    autoBalancer: { show: autoBalancer, setShow: setAutoBalancer },
    lootSimulator: { show: lootSimulator, setShow: setLootSimulator },
    powerCurveCompare: { show: powerCurveCompare, setShow: setPowerCurveCompare },
    comments: { show: comments, setShow: setComments },
    interfaceDesigner: { show: interfaceDesigner, setShow: setInterfaceDesigner },
    automations: { show: automations, setShow: setAutomations },
    sensitivity: { show: sensitivity, setShow: setSensitivity },
    changeHistory: { show: changeHistory, setShow: setChangeHistory },
    fpsSimulation: { show: fpsSimulation, setShow: setFpsSimulation },
    fpsTeamSimulation: { show: fpsTeamSimulation, setShow: setFpsTeamSimulation },
    deckSimulation: { show: deckSimulation, setShow: setDeckSimulation },
    frameData: { show: frameData, setShow: setFrameData },
    aiBehavior: { show: aiBehavior, setShow: setAiBehavior },
    matchupMatrix: { show: matchupMatrix, setShow: setMatchupMatrix },
    replayTimeline: { show: replayTimeline, setShow: setReplayTimeline },
    snapshotCompare: { show: snapshotCompare, setShow: setSnapshotCompare },
    mobaLaning: { show: mobaLaning, setShow: setMobaLaning },
    rtsBuildOrder: { show: rtsBuildOrder, setShow: setRtsBuildOrder },
    mmoRaid: { show: mmoRaid, setShow: setMmoRaid },
    autoBattler: { show: autoBattler, setShow: setAutoBattler },
    hordeSurvivor: { show: hordeSurvivor, setShow: setHordeSurvivor },
    aiPlaytest: { show: aiPlaytest, setShow: setAiPlaytest },
    formulaVerifier: { show: formulaVerifier, setShow: setFormulaVerifier },
  }), [
    calculator, comparison, chart, preset, imbalance, goal, balance,
    economy, dpsVariance, curveFitting, formulaHelper, balanceValidator,
    difficultyCurve, simulation, entityDefinition, autoBalancer, lootSimulator,
    powerCurveCompare, comments, interfaceDesigner, automations, sensitivity,
    changeHistory, fpsSimulation, fpsTeamSimulation, deckSimulation, frameData, aiBehavior, matchupMatrix, replayTimeline, snapshotCompare, mobaLaning, rtsBuildOrder, mmoRaid, autoBattler, hordeSurvivor, aiPlaytest, formulaVerifier,
  ]);

  const openByName = useCallback((name: string) => {
    const setter = (panels as Record<string, PanelState>)[name]?.setShow;
    if (setter) setter(true);
  }, [panels]);

  // CommandPalette → 패널 라우팅 이벤트 1개만 등록
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ panel: string }>).detail;
      if (detail?.panel) openByName(detail.panel);
    };
    window.addEventListener('balruno:open-panel', handler);
    return () => window.removeEventListener('balruno:open-panel', handler);
  }, [openByName]);

  return { panels, openByName };
}
