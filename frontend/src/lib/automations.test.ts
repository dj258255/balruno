import { describe, it, expect, vi } from 'vitest';
import {
  createBlankAutomation,
  createBlankFlow,
  generateNodeId,
  runAutomation,
  simulateFlow,
  type Automation,
  type AutomationNode,
} from './automations';
import type { Project } from '@/types';

const sampleProject: Project = {
  id: 'p1',
  name: 'Test',
  createdAt: 0,
  updatedAt: 0,
  syncMode: 'local',
  sheets: [{
    id: 's1',
    name: 'Sheet1',
    columns: [
      { id: 'col-name', name: 'Name', type: 'general', width: 100 },
      { id: 'col-hp', name: 'HP', type: 'general', width: 100 },
    ],
    rows: [
      { id: 'r1', cells: { 'col-name': 'A', 'col-hp': 100 } },
      { id: 'r2', cells: { 'col-name': 'B', 'col-hp': 200 } },
    ],
    createdAt: 0,
    updatedAt: 0,
  }],
};

describe('automation creation', () => {
  it('createBlankAutomation has manual trigger', () => {
    const a = createBlankAutomation('테스트');
    expect(a.nodes.length).toBe(1);
    expect(a.nodes[0].type).toBe('trigger');
    expect(a.nodes[0].subtype).toBe('manual');
    expect(a.mode).toBeUndefined();
  });

  it('createBlankFlow has source node + flow mode', () => {
    const f = createBlankFlow('흐름');
    expect(f.mode).toBe('flow');
    expect(f.nodes[0].type).toBe('flow');
    expect(f.nodes[0].subtype).toBe('source');
  });
});

describe('runAutomation', () => {
  it('manual trigger → notify action 실행', async () => {
    const trigger: AutomationNode = { id: 't', type: 'trigger', subtype: 'manual', config: {} };
    const action: AutomationNode = { id: 'a', type: 'action', subtype: 'notify', config: { message: 'hi' } };
    const automation: Automation = {
      id: 'auto1', name: 't', enabled: true,
      nodes: [trigger, action],
      edges: [{ from: 't', to: 'a' }],
      createdAt: 0, updatedAt: 0,
    };
    const onNotify = vi.fn();
    const logs = await runAutomation(automation, sampleProject, { onNotify });
    expect(onNotify).toHaveBeenCalledWith('hi');
    expect(logs.some((l) => l.message.includes('실행 완료'))).toBe(true);
  });

  it('조건 실패 시 다운스트림 차단', async () => {
    const trigger: AutomationNode = { id: 't', type: 'trigger', subtype: 'manual', config: {} };
    const cond: AutomationNode = {
      id: 'c', type: 'condition', subtype: 'compare',
      config: { sheetId: 's1', column: 'HP', op: 'gt', value: 999 },
    };
    const action: AutomationNode = { id: 'a', type: 'action', subtype: 'log', config: { message: 'should not run' } };
    const automation: Automation = {
      id: 'auto2', name: 't', enabled: true,
      nodes: [trigger, cond, action],
      edges: [{ from: 't', to: 'c' }, { from: 'c', to: 'a' }],
      createdAt: 0, updatedAt: 0,
    };
    const logs = await runAutomation(automation, sampleProject);
    // condition 실패해서 action 실행 X
    expect(logs.some((l) => l.message.includes('조건 compare: 실패'))).toBe(true);
    expect(logs.some((l) => l.nodeId === 'a' && l.message.includes('실행 완료'))).toBe(false);
  });
});

describe('simulateFlow', () => {
  it('source 100 → gate 0.5 → sink ~50 평균', () => {
    const source: AutomationNode = { id: 's', type: 'flow', subtype: 'source', config: { rate: 100 } };
    const gate: AutomationNode = { id: 'g', type: 'flow', subtype: 'gate', config: { probability: 0.5, multiplier: 1 } };
    const sink: AutomationNode = { id: 'k', type: 'flow', subtype: 'sink', config: { label: 'OUT' } };
    const automation: Automation = {
      id: 'flow1', name: 'f', enabled: true, mode: 'flow',
      nodes: [source, gate, sink],
      edges: [{ from: 's', to: 'g' }, { from: 'g', to: 'k' }],
      createdAt: 0, updatedAt: 0,
    };
    const result = simulateFlow(automation, 200);
    // 평균은 50 ± 5
    expect(result.sinkAverages['k']).toBeGreaterThan(40);
    expect(result.sinkAverages['k']).toBeLessThan(60);
  });

  it('빈 flow 도 crash 안 함', () => {
    const result = simulateFlow({
      id: 'x', name: 'x', enabled: true, mode: 'flow',
      nodes: [], edges: [], createdAt: 0, updatedAt: 0,
    }, 10);
    expect(result.iterations).toBe(10);
    expect(result.sinkTotals).toEqual({});
  });
});

describe('generateNodeId', () => {
  it('node id 가 unique 함', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateNodeId());
    expect(ids.size).toBe(100);
  });
});
