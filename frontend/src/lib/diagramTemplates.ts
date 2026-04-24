/**
 * Economy Diagram 템플릿.
 * "템플릿으로 시작" 3개 프리셋: RPG 경제 / Gacha / Idle.
 */

import type { Automation, AutomationNode, AutomationEdge } from './automations';
import { generateAutomationId, generateNodeId } from './automations';

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  build: (flowName: string) => Automation;
}

function makeNode(
  subtype: AutomationNode['subtype'],
  config: Record<string, unknown>,
  position: { x: number; y: number },
): AutomationNode {
  return {
    id: generateNodeId(),
    type: 'flow',
    subtype,
    config,
    position,
  };
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'rpg-economy',
    name: 'RPG Gold Economy',
    description: '몬스터 드롭 → 인벤토리 → 상점 구매 → 장비 순환',
    build: (flowName) => {
      const monsters = makeNode('source', { rate: 100 }, { x: 80, y: 120 });
      const dropGate = makeNode('gate', { probability: 0.3, multiplier: 50 }, { x: 280, y: 120 });
      const inventory = makeNode('pool', { capacity: 10000, initial: 0 }, { x: 480, y: 120 });
      const shopConverter = makeNode(
        'converter',
        { inputRate: 500, outputRate: 1 }, // 500 gold → 1 equipment
        { x: 680, y: 120 },
      );
      const equipmentSink = makeNode('sink', { label: 'Equipment crafted' }, { x: 880, y: 120 });
      const drainSink = makeNode('sink', { label: 'Gold drain (tax)' }, { x: 480, y: 280 });

      const nodes = [monsters, dropGate, inventory, shopConverter, equipmentSink, drainSink];
      const edges: AutomationEdge[] = [
        { from: monsters.id, to: dropGate.id },
        { from: dropGate.id, to: inventory.id },
        { from: inventory.id, to: shopConverter.id },
        { from: shopConverter.id, to: equipmentSink.id },
        { from: inventory.id, to: drainSink.id },
      ];

      return {
        id: generateAutomationId(),
        name: flowName,
        enabled: true,
        mode: 'flow',
        nodes,
        edges,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
  },
  {
    id: 'gacha-pull',
    name: 'Gacha Pull Economy',
    description: '크리스탈 → 10연 뽑기 → SSR/SR/R/N 확률 분기 → 획득',
    build: (flowName) => {
      const crystals = makeNode('source', { rate: 1000 }, { x: 80, y: 160 });
      const tenPull = makeNode('converter', { inputRate: 1600, outputRate: 10 }, { x: 280, y: 160 });
      const ssrGate = makeNode('gate', { probability: 0.006, multiplier: 1 }, { x: 480, y: 40 });
      const srGate = makeNode('gate', { probability: 0.051, multiplier: 1 }, { x: 480, y: 140 });
      const rGate = makeNode('gate', { probability: 0.943, multiplier: 1 }, { x: 480, y: 260 });
      const ssr = makeNode('sink', { label: 'SSR (legendary)' }, { x: 720, y: 40 });
      const sr = makeNode('sink', { label: 'SR (rare)' }, { x: 720, y: 140 });
      const r = makeNode('sink', { label: 'R (common)' }, { x: 720, y: 260 });

      const nodes = [crystals, tenPull, ssrGate, srGate, rGate, ssr, sr, r];
      const edges: AutomationEdge[] = [
        { from: crystals.id, to: tenPull.id },
        { from: tenPull.id, to: ssrGate.id },
        { from: tenPull.id, to: srGate.id },
        { from: tenPull.id, to: rGate.id },
        { from: ssrGate.id, to: ssr.id },
        { from: srGate.id, to: sr.id },
        { from: rGate.id, to: r.id },
      ];

      return {
        id: generateAutomationId(),
        name: flowName,
        enabled: true,
        mode: 'flow',
        nodes,
        edges,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
  },
  {
    id: 'idle-generators',
    name: 'Idle Generator Chain',
    description: 'Lemonade → Newspaper → Car Wash 순차 수익 증폭',
    build: (flowName) => {
      const lemon = makeNode('source', { rate: 1 }, { x: 80, y: 80 });
      const lemonPool = makeNode('pool', { capacity: 1000, initial: 0 }, { x: 260, y: 80 });
      const newspaperConv = makeNode('converter', { inputRate: 60, outputRate: 60 }, { x: 440, y: 160 });
      const newspaperPool = makeNode('pool', { capacity: 5000, initial: 0 }, { x: 620, y: 160 });
      const carwashConv = makeNode('converter', { inputRate: 720, outputRate: 540 }, { x: 800, y: 240 });
      const profit = makeNode('sink', { label: 'Net profit' }, { x: 1000, y: 240 });

      const nodes = [lemon, lemonPool, newspaperConv, newspaperPool, carwashConv, profit];
      const edges: AutomationEdge[] = [
        { from: lemon.id, to: lemonPool.id },
        { from: lemonPool.id, to: newspaperConv.id },
        { from: newspaperConv.id, to: newspaperPool.id },
        { from: newspaperPool.id, to: carwashConv.id },
        { from: carwashConv.id, to: profit.id },
      ];

      return {
        id: generateAutomationId(),
        name: flowName,
        enabled: true,
        mode: 'flow',
        nodes,
        edges,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
  },
];
