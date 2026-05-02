/**
 * EconomyDesign sync 로직 테스트.
 *
 * Faucet/Sink 추가·수정·삭제 시 다이어그램 노드(Source/Sink)가 자동 동기화되는지,
 * origin='manual' 노드는 영향받지 않는지, edge 정리가 제대로 되는지 검증.
 */

import { describe, it, expect } from 'vitest';
import {
  createBlankEconomy,
  migrateFlowToEconomy,
  addFaucetToDesign,
  updateFaucetInDesign,
  deleteFaucetFromDesign,
  addSinkToDesign,
  updateSinkInDesign,
  deleteSinkFromDesign,
  generateNodeId,
  type Automation,
} from './automations';
import type { Faucet, Sink } from '@/lib/economySimulator';

const makeFaucet = (id: string, ratePerHour = 100, name = 'F'): Faucet => ({
  id,
  name,
  ratePerHour,
  playerPercentage: 0.5,
});

const makeSink = (id: string, costPerUse = 50, name = 'S'): Sink => ({
  id,
  name,
  costPerUse,
  usesPerHour: 1,
  playerPercentage: 0.5,
  isRequired: false,
});

describe('createBlankEconomy', () => {
  it('mode=economy + economy 데이터 + Faucet 수만큼 Source 노드 생성', () => {
    const a = createBlankEconomy('Economy: TestSheet');
    expect(a.mode).toBe('economy');
    expect(a.economy).toBeDefined();
    const sourceNodes = a.nodes.filter((n) => n.subtype === 'source');
    const sinkNodes = a.nodes.filter((n) => n.subtype === 'sink');
    expect(sourceNodes.length).toBe(a.economy!.faucets.length);
    expect(sinkNodes.length).toBe(a.economy!.sinks.length);
  });

  it('생성된 Source 노드는 origin=faucet + faucetId 매핑', () => {
    const a = createBlankEconomy('x');
    const sourceNodes = a.nodes.filter((n) => n.subtype === 'source');
    for (const n of sourceNodes) {
      const cfg = n.config as Record<string, unknown>;
      expect(cfg.origin).toBe('faucet');
      expect(typeof cfg.faucetId).toBe('string');
      const matched = a.economy!.faucets.find((f) => f.id === cfg.faucetId);
      expect(matched).toBeDefined();
      expect(cfg.rate).toBe(matched!.ratePerHour);
    }
  });
});

describe('addFaucetToDesign', () => {
  it('faucet 배열에 추가 + Source 노드 자동 생성', () => {
    const a = createBlankEconomy('x');
    const beforeFaucets = a.economy!.faucets.length;
    const beforeSources = a.nodes.filter((n) => n.subtype === 'source').length;
    const next = addFaucetToDesign(a, makeFaucet('f_new', 50, 'New'));
    expect(next.economy!.faucets.length).toBe(beforeFaucets + 1);
    expect(next.nodes.filter((n) => n.subtype === 'source').length).toBe(beforeSources + 1);
    const newNode = next.nodes.find((n) => {
      const cfg = n.config as Record<string, unknown>;
      return cfg.faucetId === 'f_new';
    });
    expect(newNode).toBeDefined();
    expect((newNode!.config as Record<string, unknown>).rate).toBe(50);
  });
});

describe('updateFaucetInDesign', () => {
  it('rate 변경 시 매칭 Source 노드 config.rate 도 갱신', () => {
    const a = addFaucetToDesign(createBlankEconomy('x'), makeFaucet('f1', 100, 'Gold'));
    const next = updateFaucetInDesign(a, 'f1', { ratePerHour: 999 });
    const node = next.nodes.find((n) => (n.config as Record<string, unknown>).faucetId === 'f1');
    expect((node!.config as Record<string, unknown>).rate).toBe(999);
    expect(next.economy!.faucets.find((f) => f.id === 'f1')!.ratePerHour).toBe(999);
  });

  it('name 변경 시 노드 config.label 도 갱신', () => {
    const a = addFaucetToDesign(createBlankEconomy('x'), makeFaucet('f1', 100, 'Gold'));
    const next = updateFaucetInDesign(a, 'f1', { name: 'Coin' });
    const node = next.nodes.find((n) => (n.config as Record<string, unknown>).faucetId === 'f1');
    expect((node!.config as Record<string, unknown>).label).toBe('Coin');
  });

  it('존재하지 않는 id 는 무변경', () => {
    const a = createBlankEconomy('x');
    const next = updateFaucetInDesign(a, 'nope', { ratePerHour: 1 });
    expect(next.economy!.faucets).toEqual(a.economy!.faucets);
  });
});

describe('deleteFaucetFromDesign', () => {
  it('faucet 제거 + 매칭 Source 노드 제거', () => {
    const a = addFaucetToDesign(createBlankEconomy('x'), makeFaucet('f_del', 100, 'Del'));
    const next = deleteFaucetFromDesign(a, 'f_del');
    expect(next.economy!.faucets.find((f) => f.id === 'f_del')).toBeUndefined();
    expect(next.nodes.find((n) => (n.config as Record<string, unknown>).faucetId === 'f_del')).toBeUndefined();
  });

  it('연결된 edge 도 함께 정리', () => {
    let a = addFaucetToDesign(createBlankEconomy('x'), makeFaucet('f_del', 100, 'Del'));
    const sourceNode = a.nodes.find((n) => (n.config as Record<string, unknown>).faucetId === 'f_del')!;
    const sinkNode = a.nodes.filter((n) => n.subtype === 'sink')[0];
    a = { ...a, edges: [{ from: sourceNode.id, to: sinkNode.id }] };
    const next = deleteFaucetFromDesign(a, 'f_del');
    expect(next.edges.length).toBe(0);
  });

  it('manual 노드는 영향 없음', () => {
    let a = addFaucetToDesign(createBlankEconomy('x'), makeFaucet('f_keep', 100, 'Keep'));
    const manualSource = {
      id: generateNodeId(),
      type: 'flow' as const,
      subtype: 'source' as const,
      config: { rate: 7, origin: 'manual' },
      position: { x: 0, y: 0 },
    };
    a = { ...a, nodes: [...a.nodes, manualSource] };
    const next = deleteFaucetFromDesign(a, 'f_keep');
    expect(next.nodes.find((n) => n.id === manualSource.id)).toBeDefined();
  });
});

describe('Sink sync (대칭)', () => {
  it('addSinkToDesign → Sink 노드 origin=sink + sinkId 매핑', () => {
    const a = addSinkToDesign(createBlankEconomy('x'), makeSink('s_new', 80, 'Repair'));
    const node = a.nodes.find((n) => (n.config as Record<string, unknown>).sinkId === 's_new');
    expect(node).toBeDefined();
    expect((node!.config as Record<string, unknown>).label).toBe('Repair');
  });

  it('updateSinkInDesign → 매칭 Sink 노드 label 갱신', () => {
    const a = addSinkToDesign(createBlankEconomy('x'), makeSink('s1', 80, 'Old'));
    const next = updateSinkInDesign(a, 's1', { name: 'New' });
    const node = next.nodes.find((n) => (n.config as Record<string, unknown>).sinkId === 's1');
    expect((node!.config as Record<string, unknown>).label).toBe('New');
  });

  it('deleteSinkFromDesign → 매칭 Sink 노드 + edge 정리, manual 보호', () => {
    let a = addSinkToDesign(createBlankEconomy('x'), makeSink('s_del', 80));
    const sinkNode = a.nodes.find((n) => (n.config as Record<string, unknown>).sinkId === 's_del')!;
    const manualSink = {
      id: generateNodeId(),
      type: 'flow' as const,
      subtype: 'sink' as const,
      config: { label: 'Manual', origin: 'manual' },
      position: { x: 0, y: 0 },
    };
    a = {
      ...a,
      nodes: [...a.nodes, manualSink],
      edges: [{ from: 'unknown', to: sinkNode.id }],
    };
    const next = deleteSinkFromDesign(a, 's_del');
    expect(next.nodes.find((n) => n.id === sinkNode.id)).toBeUndefined();
    expect(next.nodes.find((n) => n.id === manualSink.id)).toBeDefined();
    expect(next.edges.length).toBe(0);
  });
});

describe('migrateFlowToEconomy', () => {
  it('mode=flow → economy 로 전환, Source/Sink 노드에 origin=manual 주입', () => {
    const flow: Automation = {
      id: 'a1',
      name: 'Economy: Test',
      enabled: false,
      mode: 'flow',
      nodes: [
        { id: 'n1', type: 'flow', subtype: 'source', config: { rate: 10 }, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'flow', subtype: 'sink', config: { label: 'Drain' }, position: { x: 0, y: 0 } },
        { id: 'n3', type: 'flow', subtype: 'pool', config: { capacity: 100 }, position: { x: 0, y: 0 } },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const next = migrateFlowToEconomy(flow);
    expect(next.mode).toBe('economy');
    expect(next.economy).toBeDefined();
    const n1cfg = next.nodes.find((n) => n.id === 'n1')!.config as Record<string, unknown>;
    const n2cfg = next.nodes.find((n) => n.id === 'n2')!.config as Record<string, unknown>;
    const n3cfg = next.nodes.find((n) => n.id === 'n3')!.config as Record<string, unknown>;
    expect(n1cfg.origin).toBe('manual');
    expect(n2cfg.origin).toBe('manual');
    expect(n3cfg.origin).toBeUndefined(); // pool 은 mark 안 함
  });

  it('이미 origin 이 있는 노드는 유지', () => {
    const flow: Automation = {
      id: 'a1',
      name: 'x',
      enabled: false,
      mode: 'flow',
      nodes: [
        { id: 'n1', type: 'flow', subtype: 'source', config: { rate: 10, origin: 'faucet', faucetId: 'fc1' }, position: { x: 0, y: 0 } },
      ],
      edges: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const next = migrateFlowToEconomy(flow);
    const cfg = next.nodes[0].config as Record<string, unknown>;
    expect(cfg.origin).toBe('faucet');
    expect(cfg.faucetId).toBe('fc1');
  });
});
