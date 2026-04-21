'use client';

/**
 * Track 15 — Economy Diagram View.
 *
 * Machinations-lite: Source → Gate → Converter → Sink + Pool 노드를
 * SVG 위에 배치하고, 각 노드의 rate/probability 를 시트 cell 로부터 참조 가능.
 *
 * MVP 스코프:
 *  - 노드 CRUD (source / gate / sink / pool / converter)
 *  - 드래그 이동
 *  - edge 연결 (노드 간)
 *  - 각 노드 config inspector (사이드 패널)
 *  - Run simulation (기존 simulateFlow 확장)
 *  - Sheet cell 참조: node.rateRef = `=Sheet!colId!rowId`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Droplet, Filter, Target, Database, RefreshCw, Play, Loader2, Plus, Trash2,
  Copy, Scissors, ExternalLink, Download,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { Sheet } from '@/types';
import type { Automation, AutomationNode, AutomationEdge, FlowSimResult } from '@/lib/automations';
import {
  createBlankFlow,
  simulateFlow,
  generateNodeId,
  loadAutomations,
  saveAutomations,
} from '@/lib/automations';
import { DIAGRAM_TEMPLATES } from '@/lib/diagramTemplates';

interface Props {
  projectId: string;
  sheet: Sheet;
}

type EconomyNodeSubtype = 'source' | 'gate' | 'sink' | 'pool' | 'converter';

const NODE_ICONS: Record<EconomyNodeSubtype, typeof Droplet> = {
  source: Droplet,
  gate: Filter,
  sink: Target,
  pool: Database,
  converter: RefreshCw,
};

const NODE_COLORS: Record<EconomyNodeSubtype, string> = {
  source: '#3b82f6',
  gate: '#f59e0b',
  sink: '#10b981',
  pool: '#8b5cf6',
  converter: '#ec4899',
};

const NODE_LABELS: Record<EconomyNodeSubtype, string> = {
  source: 'Source',
  gate: 'Gate',
  sink: 'Sink',
  pool: 'Pool',
  converter: 'Converter',
};

export default function DiagramView({ projectId, sheet }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [result, setResult] = useState<FlowSimResult | null>(null);
  const [running, setRunning] = useState(false);

  // 시트 이름으로 Flow 매칭 — "Economy_{sheetName}" 규칙
  const flowName = useMemo(() => `Economy: ${sheet.name}`, [sheet.name]);

  useEffect(() => {
    const list = loadAutomations(projectId).filter((a) => a.mode === 'flow');
    setAutomations(list);
    const match = list.find((a) => a.name === flowName);
    setCurrentFlowId(match?.id ?? null);
  }, [projectId, flowName]);

  const currentFlow = automations.find((a) => a.id === currentFlowId);

  const persist = useCallback(
    (updated: Automation[]) => {
      setAutomations(updated);
      // 다른 (non-flow) automations 는 유지해서 같이 저장
      const all = loadAutomations(projectId);
      const nonFlow = all.filter((a) => a.mode !== 'flow');
      saveAutomations(projectId, [...nonFlow, ...updated]);
    },
    [projectId]
  );

  const createFlow = () => {
    const flow = createBlankFlow(flowName);
    flow.nodes[0].position = { x: 100, y: 150 };
    persist([...automations, flow]);
    setCurrentFlowId(flow.id);
  };

  const createFromTemplate = (templateId: string) => {
    const tpl = DIAGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const flow = tpl.build(flowName);
    persist([...automations, flow]);
    setCurrentFlowId(flow.id);
  };

  const updateFlow = (updater: (flow: Automation) => Automation) => {
    if (!currentFlow) return;
    const updated = automations.map((a) => (a.id === currentFlow.id ? updater(a) : a));
    persist(updated);
  };

  const addNode = (subtype: EconomyNodeSubtype) => {
    updateFlow((flow) => {
      const defaults: Record<EconomyNodeSubtype, Record<string, unknown>> = {
        source: { rate: 10 },
        gate: { probability: 0.5, multiplier: 1 },
        sink: { label: 'Drain' },
        pool: { capacity: 100, initial: 0 },
        converter: { inputRate: 1, outputRate: 1 },
      };
      const newNode: AutomationNode = {
        id: generateNodeId(),
        type: 'flow',
        subtype: subtype as never,
        config: defaults[subtype],
        position: { x: 200 + flow.nodes.length * 140, y: 150 },
      };
      return { ...flow, nodes: [...flow.nodes, newNode], updatedAt: Date.now() };
    });
  };

  const deleteNode = (nodeId: string) => {
    updateFlow((flow) => ({
      ...flow,
      nodes: flow.nodes.filter((n) => n.id !== nodeId),
      edges: flow.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      updatedAt: Date.now(),
    }));
    setSelectedNodeId(null);
  };

  const updateNode = (nodeId: string, patch: Partial<AutomationNode>) => {
    updateFlow((flow) => ({
      ...flow,
      nodes: flow.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      updatedAt: Date.now(),
    }));
  };

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    updateFlow((flow) => {
      if (flow.edges.some((e) => e.from === from && e.to === to)) return flow;
      return { ...flow, edges: [...flow.edges, { from, to }], updatedAt: Date.now() };
    });
  };

  // 드래그 상태
  const dragState = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const connectState = useRef<{ fromId: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 줌 / 팬 (viewBox 조작)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1400, h: 900 });
  const panState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Track 15-B — SVG / PNG 내보내기.
  // CSS 변수(var(--xxx))를 실제 색으로 치환해야 외부 이미지에서도 색이 맞음.
  const serializeSvg = useCallback((): { xml: string; width: number; height: number; bg: string } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', String(viewBox.w));
    clone.setAttribute('height', String(viewBox.h));

    const rootStyle = getComputedStyle(document.documentElement);
    const varRegex = /var\((--[\w-]+)\)/g;
    const resolveVars = (value: string): string =>
      value.replace(varRegex, (_, name: string) => rootStyle.getPropertyValue(name).trim() || '#000');

    const walk = (el: Element) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.value.includes('var(')) el.setAttribute(attr.name, resolveVars(attr.value));
      }
      const style = el.getAttribute('style');
      if (style && style.includes('var(')) el.setAttribute('style', resolveVars(style));
      Array.from(el.children).forEach(walk);
    };
    walk(clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const bg = rootStyle.getPropertyValue('--bg-primary').trim() || '#ffffff';
    return { xml, width: viewBox.w, height: viewBox.h, bg };
  }, [viewBox.w, viewBox.h]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportSvg = () => {
    const s = serializeSvg();
    if (!s) return;
    const name = `balruno-diagram-${flowName.replace(/[^\w-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.svg`;
    downloadBlob(new Blob([s.xml], { type: 'image/svg+xml;charset=utf-8' }), name);
  };

  const exportPng = async () => {
    const s = serializeSvg();
    if (!s) return;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = s.width * scale;
    canvas.height = s.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const svgBlob = new Blob([s.xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG 로드 실패'));
        img.src = url;
      });
      ctx.drawImage(img, 0, 0, s.width, s.height);
    } finally {
      URL.revokeObjectURL(url);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const name = `balruno-diagram-${flowName.replace(/[^\w-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.png`;
      downloadBlob(blob, name);
    }, 'image/png');
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const svg = e.currentTarget as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
    setViewBox((prev) => {
      const newW = Math.max(300, Math.min(4000, prev.w * zoomFactor));
      const newH = (newW / prev.w) * prev.h;
      const newX = p.x - ((p.x - prev.x) * newW) / prev.w;
      const newY = p.y - ((p.y - prev.y) * newH) / prev.h;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  const handlePanStart = (e: React.PointerEvent) => {
    // 팬 시작: 터치는 단일 손가락, 마우스는 middle 또는 Alt+drag.
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (!isTouch && e.button !== 1 && !e.altKey) return;
    e.preventDefault();
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: viewBox.x,
      origY: viewBox.y,
    };
  };

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 입력 포커스 시 무시
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (!selectedNodeId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        connectState.current = null;
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // 복제
        const node = currentFlow?.nodes.find((n) => n.id === selectedNodeId);
        if (!node) return;
        updateFlow((flow) => {
          const newId = generateNodeId();
          const cloned: AutomationNode = {
            ...node,
            id: newId,
            position: {
              x: (node.position?.x ?? 0) + 30,
              y: (node.position?.y ?? 0) + 30,
            },
          };
          return { ...flow, nodes: [...flow.nodes, cloned], updatedAt: Date.now() };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, currentFlow]);

  const resetView = () => setViewBox({ x: 0, y: 0, w: 1400, h: 900 });

  // 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close);
    };
  }, [ctxMenu]);

  const duplicateNode = (nodeId: string) => {
    const node = currentFlow?.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newId = generateNodeId();
    updateFlow((flow) => ({
      ...flow,
      nodes: [
        ...flow.nodes,
        {
          ...node,
          id: newId,
          position: {
            x: (node.position?.x ?? 0) + 30,
            y: (node.position?.y ?? 0) + 30,
          },
        },
      ],
      updatedAt: Date.now(),
    }));
    setSelectedNodeId(newId);
  };

  const disconnectAll = (nodeId: string) => {
    updateFlow((flow) => ({
      ...flow,
      edges: flow.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      updatedAt: Date.now(),
    }));
  };

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const run = () => {
    if (!currentFlow) return;
    setRunning(true);
    setTimeout(() => {
      const res = simulateFlow(currentFlow, 1000, project?.sheets ?? []);
      setResult(res);
      setRunning(false);
    }, 50);
  };

  if (!currentFlow) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center space-y-4 max-w-2xl">
          <RefreshCw className="w-12 h-12 mx-auto" style={{ color: 'var(--text-tertiary)' }} />
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            이 시트의 Economy Diagram 이 없습니다
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DIAGRAM_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => createFromTemplate(tpl.id)}
                className="p-3 rounded-lg border text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: 'var(--border-primary)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {tpl.name}
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {tpl.description}
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={createFlow}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              <Plus className="w-3 h-3 inline mr-1" />
              빈 Diagram 으로 시작
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Machinations 스타일의 경제 다이어그램. Source → Gate → Pool → Converter → Sink 로
            자원 흐름을 시각화하고 Monte Carlo 시뮬로 밸런스를 검증합니다.
          </p>
        </div>
      </div>
    );
  }

  const selectedNode = currentFlow.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex-1 flex" style={{ background: 'var(--bg-primary)' }}>
      {/* 캔버스 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 툴바 */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            노드 추가:
          </span>
          {(['source', 'pool', 'gate', 'converter', 'sink'] as const).map((t) => {
            const Icon = NODE_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => addNode(t)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-tertiary)', color: NODE_COLORS[t] }}
              >
                <Icon className="w-3 h-3" />
                {NODE_LABELS[t]}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportSvg}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              title="SVG 로 내보내기"
            >
              <Download className="w-3 h-3" />
              SVG
            </button>
            <button
              onClick={exportPng}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              title="PNG 로 내보내기 (2x)"
            >
              <Download className="w-3 h-3" />
              PNG
            </button>
            <button
              onClick={resetView}
              className="px-2 py-1 rounded text-[11px]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              title="뷰 초기화"
            >
              100%
            </button>
            <button
              onClick={run}
              disabled={running}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium"
              style={{
                background: running ? 'var(--bg-tertiary)' : 'var(--primary-purple)',
                color: running ? 'var(--text-secondary)' : 'white',
              }}
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              시뮬 (1000회)
            </button>
          </div>
        </div>

        {/* SVG 캔버스 */}
        <div className="flex-1 overflow-auto relative">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              minHeight: 600,
              cursor: panState.current ? 'grabbing' : 'default',
              touchAction: 'none', // 터치 팬/드래그 중 브라우저 스크롤·줌 억제
            }}
            onWheel={handleWheel}
            onPointerDown={handlePanStart}
            onPointerMove={(e) => {
              const svg = e.currentTarget;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const ctm = svg.getScreenCTM();
              if (!ctm) return;
              const p = pt.matrixTransform(ctm.inverse());
              setMousePos({ x: p.x, y: p.y });

              if (panState.current) {
                const scale = viewBox.w / (svg.getBoundingClientRect().width || 1);
                setViewBox((prev) => ({
                  ...prev,
                  x: panState.current!.origX - (e.clientX - panState.current!.startX) * scale,
                  y: panState.current!.origY - (e.clientY - panState.current!.startY) * scale,
                }));
                return;
              }

              if (dragState.current) {
                const { nodeId, offsetX, offsetY } = dragState.current;
                updateNode(nodeId, { position: { x: p.x - offsetX, y: p.y - offsetY } });
              }
            }}
            onPointerUp={() => {
              dragState.current = null;
              connectState.current = null;
              panState.current = null;
            }}
            onPointerCancel={() => {
              dragState.current = null;
              connectState.current = null;
              panState.current = null;
            }}
            onClick={() => setSelectedNodeId(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* 격자 배경 */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-primary)" strokeWidth="0.5" opacity="0.3" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-secondary)" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {currentFlow.edges.map((edge) => {
              const from = currentFlow.nodes.find((n) => n.id === edge.from);
              const to = currentFlow.nodes.find((n) => n.id === edge.to);
              if (!from?.position || !to?.position) return null;
              const x1 = from.position.x + 60;
              const y1 = from.position.y + 30;
              const x2 = to.position.x + 60;
              const y2 = to.position.y + 30;
              const edgeKey = `${edge.from}->${edge.to}`;
              const flow = result?.edgeFlow[edgeKey] ?? 0;
              return (
                <g key={edgeKey}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--text-secondary)"
                    strokeWidth={1.5}
                    markerEnd="url(#arrow)"
                  />
                  {result && flow > 0 && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 6}
                      fontSize="10"
                      textAnchor="middle"
                      fill="var(--text-primary)"
                    >
                      {flow.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Connection in progress */}
            {connectState.current && mousePos && (() => {
              const from = currentFlow.nodes.find((n) => n.id === connectState.current?.fromId);
              if (!from?.position) return null;
              return (
                <line
                  x1={from.position.x + 60}
                  y1={from.position.y + 30}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="4,2"
                />
              );
            })()}

            {/* Nodes */}
            {currentFlow.nodes.map((node) => {
              if (!node.position) return null;
              const subtype = node.subtype as EconomyNodeSubtype;
              const Icon = NODE_ICONS[subtype] ?? Droplet;
              const color = NODE_COLORS[subtype] ?? '#3b82f6';
              const selected = selectedNodeId === node.id;
              const sinkTotal = subtype === 'sink' ? result?.sinkAverages[node.id] : undefined;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.position.x}, ${node.position.y})`}
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const svg = (e.target as SVGElement).ownerSVGElement!;
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const ctm = svg.getScreenCTM();
                    if (!ctm) return;
                    const p = pt.matrixTransform(ctm.inverse());
                    dragState.current = {
                      nodeId: node.id,
                      offsetX: p.x - node.position!.x,
                      offsetY: p.y - node.position!.y,
                    };
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectState.current) {
                      addEdge(connectState.current.fromId, node.id);
                      connectState.current = null;
                      return;
                    }
                    setSelectedNodeId(node.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    connectState.current = { fromId: node.id };
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                  }}
                >
                  <rect
                    width={120}
                    height={60}
                    rx={8}
                    fill="var(--bg-secondary)"
                    stroke={selected ? 'var(--accent)' : color}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                  <foreignObject x={8} y={8} width={16} height={16}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </foreignObject>
                  <text x={30} y={22} fontSize="11" fontWeight="600" fill="var(--text-primary)">
                    {NODE_LABELS[subtype]}
                  </text>
                  <text x={8} y={42} fontSize="10" fill="var(--text-secondary)">
                    {subtype === 'source' && `rate: ${(node.config as { rate?: number }).rate ?? 0}`}
                    {subtype === 'gate' && `p: ${((node.config as { probability?: number }).probability ?? 0).toFixed(2)}`}
                    {subtype === 'sink' && (sinkTotal !== undefined ? `avg: ${sinkTotal.toFixed(1)}` : 'drain')}
                    {subtype === 'pool' && `cap: ${(node.config as { capacity?: number }).capacity ?? 0}`}
                    {subtype === 'converter' && `${(node.config as { inputRate?: number }).inputRate ?? 1}:${(node.config as { outputRate?: number }).outputRate ?? 1}`}
                  </text>
                  <text x={8} y={54} fontSize="9" fill="var(--text-tertiary)">
                    더블클릭: 연결 시작
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 요약 */}
        {result && (
          <div className="border-t p-3 text-xs" style={{ borderColor: 'var(--border-primary)' }}>
            <b>시뮬 결과 ({result.iterations}회):</b>{' '}
            {Object.entries(result.sinkAverages)
              .map(([nodeId, avg]) => {
                const node = currentFlow.nodes.find((n) => n.id === nodeId);
                return `${node?.subtype === 'sink' ? 'Sink' : 'Node'} ${nodeId.slice(-4)}: ${avg.toFixed(2)}`;
              })
              .join(' · ')}
          </div>
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          className="fixed rounded-md shadow-xl overflow-hidden z-[1000]"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            minWidth: 180,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxButton
            icon={Copy}
            label="복제 (⌘D)"
            onClick={() => {
              duplicateNode(ctxMenu.nodeId);
              setCtxMenu(null);
            }}
          />
          <CtxButton
            icon={Scissors}
            label="모든 연결 끊기"
            onClick={() => {
              disconnectAll(ctxMenu.nodeId);
              setCtxMenu(null);
            }}
          />
          <CtxButton
            icon={ExternalLink}
            label="연결된 시트로 점프"
            onClick={() => {
              const node = currentFlow.nodes.find((n) => n.id === ctxMenu.nodeId);
              const cfg = node?.config as Record<string, unknown> | undefined;
              const ref = cfg?.rate || cfg?.probability;
              // =sheet!col!row 파싱
              if (typeof ref === 'string' && ref.startsWith('=')) {
                const [sheetId] = ref.slice(1).split('!');
                useProjectStore.getState().setCurrentSheet(sheetId);
              }
              setCtxMenu(null);
            }}
          />
          <div className="h-px" style={{ background: 'var(--border-primary)' }} />
          <CtxButton
            icon={Trash2}
            label="노드 삭제 (Delete)"
            danger
            onClick={() => {
              deleteNode(ctxMenu.nodeId);
              setCtxMenu(null);
            }}
          />
        </div>
      )}

      {/* 사이드 인스펙터 */}
      {selectedNode && (
        <aside
          className="w-64 border-l p-3 overflow-y-auto"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {NODE_LABELS[selectedNode.subtype as EconomyNodeSubtype]} 설정
            </h3>
            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
              aria-label="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
            </button>
          </div>
          <NodeInspector
            node={selectedNode}
            onChange={(cfg) => updateNode(selectedNode.id, { config: cfg })}
          />
          <div className="mt-4 text-[10px] space-y-1" style={{ color: 'var(--text-tertiary)' }}>
            <div><b>팁 1:</b> 노드 더블클릭 → 다른 노드 클릭 = edge 생성.</div>
            <div>
              <b>팁 2 (Track 15-3):</b> rate/probability 자리에{' '}
              <code style={{ color: 'var(--primary-purple)' }}>=Sheet!colId!rowId</code>{' '}
              입력하면 시트 cell 값 실시간 참조. 시트 편집 → 다음 시뮬에 반영됨.
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function NodeInspector({
  node,
  onChange,
}: {
  node: AutomationNode;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const cfg = node.config;
  const set = (patch: Record<string, unknown>) => onChange({ ...cfg, ...patch });

  if (node.subtype === 'source') {
    return (
      <Field label="Rate (tokens/iter)">
        <input
          type="text"
          value={String(cfg.rate ?? '')}
          onChange={(e) => {
            const n = Number(e.target.value);
            set({ rate: Number.isFinite(n) ? n : e.target.value });
          }}
          className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'gate') {
    return (
      <>
        <Field label="Probability (0-1)">
          <input
            type="text"
            value={String(cfg.probability ?? '')}
            onChange={(e) => {
              const n = Number(e.target.value);
              set({ probability: Number.isFinite(n) ? n : e.target.value });
            }}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Multiplier">
          <input
            type="number"
            step="0.1"
            value={Number(cfg.multiplier ?? 1)}
            onChange={(e) => set({ multiplier: Number(e.target.value) })}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </>
    );
  }

  if (node.subtype === 'sink') {
    return (
      <Field label="Label">
        <input
          value={String(cfg.label ?? '')}
          onChange={(e) => set({ label: e.target.value })}
          className="w-full px-2 py-1 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'pool') {
    return (
      <>
        <Field label="Capacity">
          <input
            type="number"
            value={Number(cfg.capacity ?? 0)}
            onChange={(e) => set({ capacity: Number(e.target.value) })}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Initial">
          <input
            type="number"
            value={Number(cfg.initial ?? 0)}
            onChange={(e) => set({ initial: Number(e.target.value) })}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </>
    );
  }

  if (node.subtype === 'converter') {
    return (
      <>
        <Field label="Input rate">
          <input
            type="number"
            step="0.1"
            value={Number(cfg.inputRate ?? 1)}
            onChange={(e) => set({ inputRate: Number(e.target.value) })}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Output rate">
          <input
            type="number"
            step="0.1"
            value={Number(cfg.outputRate ?? 1)}
            onChange={(e) => set({ outputRate: Number(e.target.value) })}
            className="w-full px-2 py-1 text-xs rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </>
    );
  }

  return null;
}

function CtxButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--bg-hover)]"
      style={{ color: danger ? 'var(--error)' : 'var(--text-primary)' }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <label className="text-[10px] block mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
