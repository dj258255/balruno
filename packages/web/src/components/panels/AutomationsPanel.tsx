/**
 * Automations 패널.
 *
 * 자동화 룰 리스트 + 각 룰의 노드 그래프 편집 (단순 list 형식).
 * 좌측: 자동화 목록 / 우측: 선택된 자동화의 노드 편집 + 실행 로그.
 *
 * 노드 그래프는 단순화: list 로 표시 (위→아래 순서가 곧 edge).
 * 향후 SVG canvas 그래프 뷰로 업그레이드 가능 — 데이터 모델은 graph 친화.
 */

import { useEffect, useState, useMemo } from 'react';
import { Workflow, Plus, Play, Trash2, Power, ChevronRight, Zap, GitBranch, Bell, FileEdit, Globe, Activity, Droplet, Filter, Target } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import {
  loadAutomations,
  saveAutomations,
  createBlankAutomation,
  createBlankFlow,
  generateNodeId,
  runAutomation,
  simulateFlow,
  type Automation,
  type AutomationNode,
  type ExecutionLog,
  type NodeType,
  type TriggerType,
  type ConditionType,
  type ActionType,
  type FlowType,
  type FlowSimResult,
} from '@/lib/automations';
import { toast } from '@/components/ui/Toast';
import PanelShell from '@/components/ui/PanelShell';
import Checkbox from '@/components/ui/Checkbox';
import Select from '@/components/ui/Select';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

const SUBTYPE_ICON: Record<string, typeof Zap> = {
  manual: Zap,
  'cell-changed': Zap,
  'row-added': Zap,
  schedule: Zap,
  'playtest-started': Zap,
  'playtest-ended': Zap,
  compare: GitBranch,
  threshold: GitBranch,
  branch: GitBranch,
  notify: Bell,
  'update-cell': FileEdit,
  log: Activity,
  webhook: Globe,
  delay: Activity,
  'loop-rows': Activity,
  calc: Activity,
  'snapshot-stats': Activity,
  'create-retro-task': Activity,
  source: Droplet,
  gate: Filter,
  sink: Target,
};

const SUBTYPE_LABELS: Record<string, string> = {
  manual: 'automations.tManual',
  'cell-changed': 'automations.tCellChanged',
  'row-added': 'automations.tRowAdded',
  schedule: 'automations.tSchedule',
  'playtest-started': 'automations.tPlaytestStart',
  'playtest-ended': 'automations.tPlaytestEnd',
  compare: 'automations.cCompare',
  threshold: 'automations.cThreshold',
  branch: 'automations.cBranch',
  notify: 'automations.aNotify',
  'update-cell': 'automations.aUpdateCell',
  log: 'automations.aLog',
  webhook: 'automations.aWebhook',
  delay: 'automations.aDelay',
  'loop-rows': 'automations.aLoopRows',
  calc: 'automations.aCalc',
  'snapshot-stats': 'automations.aSnapshotStats',
  'create-retro-task': 'automations.aCreateRetro',
  source: 'automations.flowSource',
  gate: 'automations.flowGate',
  sink: 'automations.flowSink',
};

export default function AutomationsPanel({ onClose }: Props) {
  const t = useTranslations();

  const { projects, currentProjectId, updateCell } = useProjectStore();
  const project = projects.find((p) => p.id === currentProjectId);

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  // 과거 실행 히스토리 — localStorage 에 최근 20개 보관
  const [runHistory, setRunHistory] = useState<Array<{
    automationId: string;
    automationName: string;
    timestamp: number;
    logs: ExecutionLog[];
  }>>([]);
  const [flowResult, setFlowResult] = useState<FlowSimResult | null>(null);
  const [flowIterations, setFlowIterations] = useState(1000);

  useEffect(() => {
    if (currentProjectId) {
      const list = loadAutomations(currentProjectId);
      setAutomations(list);
      setSelectedId(list[0]?.id ?? null);
      // 실행 히스토리 로드
      try {
        const raw = localStorage.getItem(`balruno:automation-runs:${currentProjectId}`);
        setRunHistory(raw ? JSON.parse(raw) : []);
      } catch {
        setRunHistory([]);
      }
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) saveAutomations(currentProjectId, automations);
  }, [currentProjectId, automations]);

  const selected = useMemo(() => automations.find((a) => a.id === selectedId), [automations, selectedId]);

  const addAutomation = () => {
    const t = useTranslations();
    const next = createBlankAutomation(t('automations.newAutomationName', { n: automations.length + 1 }));
    setAutomations((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const addFlow = () => {
    const t = useTranslations();
    const next = createBlankFlow(t('automations.newFlowName', { n: automations.filter((a) => a.mode === 'flow').length + 1 }));
    setAutomations((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const runFlow = () => {
    if (!selected) return;
    const result = simulateFlow(selected, flowIterations);
    setFlowResult(result);
  };

  const deleteAutomation = (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateAutomation = (id: string, patch: Partial<Automation>) => {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)));
  };

  const addNode = (type: NodeType, subtype: string) => {
    const t = useTranslations();
    if (!selected) return;
    const lastNode = selected.nodes[selected.nodes.length - 1];
    const defaultConfig: Record<string, unknown> = (() => {
      const t = useTranslations();
      if (subtype === 'source') return { rate: 100 };
      if (subtype === 'gate') return { probability: 0.5, multiplier: 1 };
      if (subtype === 'sink') return { label: t('automations.sinkResult') };
      return {};
    })();
    const newNode: AutomationNode = {
      id: generateNodeId(),
      type,
      subtype: subtype as TriggerType | ConditionType | ActionType | FlowType,
      config: defaultConfig,
    };
    const newEdges = lastNode ? [...selected.edges, { from: lastNode.id, to: newNode.id }] : selected.edges;
    updateAutomation(selected.id, {
      nodes: [...selected.nodes, newNode],
      edges: newEdges,
    });
  };

  const updateNode = (nodeId: string, patch: Partial<AutomationNode>) => {
    if (!selected) return;
    updateAutomation(selected.id, {
      nodes: selected.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    });
  };

  const removeNode = (nodeId: string) => {
    if (!selected) return;
    updateAutomation(selected.id, {
      nodes: selected.nodes.filter((n) => n.id !== nodeId),
      edges: selected.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    });
  };

  const run = async () => {
    if (!selected || !project) return;
    setLogs([]);
    const result = await runAutomation(selected, project, {
      onNotify: (msg) => toast.info(msg),
      onUpdateCell: (sheetId, rowId, columnId, value) => {
        if (!currentProjectId) return;
        updateCell(currentProjectId, sheetId, rowId, columnId, value as never);
      },
    });
    setLogs(result);

    // 히스토리 저장 — 최근 20개
    if (currentProjectId) {
      const entry = {
        automationId: selected.id,
        automationName: selected.name,
        timestamp: Date.now(),
        logs: result,
      };
      const next = [entry, ...runHistory].slice(0, 20);
      setRunHistory(next);
      try {
        localStorage.setItem(
          `balruno:automation-runs:${currentProjectId}`,
          JSON.stringify(next)
        );
      } catch {
        // 쿼터 초과 무시
      }
    }
  };

  return (
    <PanelShell
      title="Automations"
      subtitle={t('automations.subtitleHeader')}
      icon={Workflow}
      onClose={onClose}
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="h-full flex overflow-hidden">
        {/* 좌측: 자동화 목록 */}
        <div className="w-40 border-r overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={addAutomation}
            className="w-full p-2 text-xs flex items-center justify-center gap-1 border-b"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--accent)' }}
          >
            <Plus size={12} /> {t('automations.newAutomation')}
          </button>
          <button
            onClick={addFlow}
            className="w-full p-2 text-xs flex items-center justify-center gap-1 border-b"
            style={{ borderColor: 'var(--border-primary)', color: '#8b5cf6' }}
          >
            <Droplet size={12} /> {t('automations.newFlow')}
          </button>
          {automations.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="p-2 cursor-pointer border-b group flex items-center gap-1.5"
              style={{
                borderColor: 'var(--border-primary)',
                background: selectedId === a.id ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              {a.mode === 'flow' ? (
                <Droplet size={10} style={{ color: '#8b5cf6' }} />
              ) : (
                <Power
                  size={10}
                  style={{ color: a.enabled ? '#10b981' : 'var(--text-secondary)' }}
                />
              )}
              <span className="text-caption flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {a.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAutomation(a.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-primary)]"
              >
                <Trash2 size={10} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          ))}
          {automations.length === 0 && (
            <p className="text-caption p-2 text-center" style={{ color: 'var(--text-secondary)' }}>
              {t('automations.noAutomation')}
            </p>
          )}
        </div>

        {/* 우측: 노드 편집 */}
        <div className="flex-1 overflow-y-auto p-3">
          {!selected ? (
            <div className="text-xs text-center mt-8" style={{ color: 'var(--text-secondary)' }}>
              {t('automations.pickOrAdd')}
            </div>
          ) : (
            <div className="space-y-3">
              {/* 메타 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={selected.name}
                    onChange={(e) => updateAutomation(selected.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm rounded border bg-transparent font-semibold"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                  <label className="flex items-center gap-1.5 text-caption cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                    <Checkbox
                      checked={selected.enabled}
                      onChange={(e) => updateAutomation(selected.id, { enabled: e.target.checked })}
                    />
                    {t('automations.enable')}
                  </label>
                  {selected.mode === 'flow' ? (
                    <>
                      <input
                        type="number"
                        value={flowIterations}
                        min={100}
                        max={50000}
                        step={100}
                        onChange={(e) => setFlowIterations(Math.max(100, parseInt(e.target.value) || 1000))}
                        className="w-20 px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                        title={t('automations.mcRunsTitle')}
                      />
                      <button
                        onClick={runFlow}
                        className="px-2 py-1 text-xs rounded flex items-center gap-1"
                        style={{ background: '#8b5cf6', color: 'white' }}
                      >
                        <Droplet size={10} /> {t('automations.monteCarloRun')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={run}
                      className="px-2 py-1 text-xs rounded flex items-center gap-1"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      <Play size={10} /> {t('automations.testRun')}
                    </button>
                  )}
                </div>
                <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                  {selected.mode === 'flow'
                    ? t('automations.flowNote')
                    : t('automations.automationNote')}
                </p>
              </div>

              {/* 노드 그래프 (list view) */}
              <div className="space-y-1.5">
                {selected.nodes.map((node, idx) => (
                  <div key={node.id}>
                    <NodeCard
                      node={node}
                      project={project}
                      onUpdate={(patch) => updateNode(node.id, patch)}
                      onRemove={() => removeNode(node.id)}
                    />
                    {idx < selected.nodes.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ChevronRight size={12} style={{ color: 'var(--text-secondary)', transform: 'rotate(90deg)' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 노드 추가 */}
              <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>{t('automations.addNode')}</div>
                {selected.mode === 'flow' ? (
                  <FlowNodeAdder onAdd={addNode} />
                ) : (
                  <NodeAdder onAdd={addNode} hasTrigger={selected.nodes.some((n) => n.type === 'trigger')} />
                )}
              </div>

              {/* Flow 시뮬 결과 */}
              {selected.mode === 'flow' && flowResult && (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('automations.simResult', { n: flowResult.iterations.toLocaleString() })}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(flowResult.sinkAverages).map(([id, avg]) => {
                      const node = selected.nodes.find((n) => n.id === id);
                      const label = (node?.config as { label?: string })?.label ?? t('automations.sinkResult');
                      return (
                        <div key={id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Target size={10} style={{ color: '#10b981' }} />
                            {label}
                          </span>
                          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {t('automations.avgTotal', { avg: avg.toFixed(2), total: flowResult.sinkTotals[id].toLocaleString() })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 실행 로그 (최신) */}
              {logs.length > 0 && (
                <div className="border-t pt-3 space-y-1" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>{t('automations.execLog')}</div>
                  <div className="space-y-0.5 font-mono text-caption max-h-40 overflow-y-auto p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                    {logs.map((l, i) => (
                      <div key={i} className="flex gap-2" style={{
                        color: l.level === 'error' ? '#ef4444' : l.level === 'warn' ? '#f59e0b' : 'var(--text-secondary)',
                      }}>
                        <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span className="flex-1">{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 실행 히스토리 — 최근 20회 */}
              {runHistory.length > 0 && (
                <div className="border-t pt-3 space-y-1" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center justify-between">
                    <div className="text-caption font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {t('automations.runHistory', { n: runHistory.length })}
                    </div>
                    <button
                      onClick={() => {
                        setRunHistory([]);
                        if (currentProjectId) {
                          localStorage.removeItem(`balruno:automation-runs:${currentProjectId}`);
                        }
                      }}
                      className="text-caption"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('automations.clear')}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {runHistory.map((r, i) => {
                      const hasError = r.logs.some((l) => l.level === 'error');
                      return (
                        <details key={i} className="text-caption rounded" style={{ background: 'var(--bg-secondary)' }}>
                          <summary className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: hasError ? '#ef4444' : '#10b981' }}
                            />
                            <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                              {r.automationName}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(r.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              {t('automations.logsCount', { n: r.logs.length })}
                            </span>
                          </summary>
                          <div className="p-2 space-y-0.5 font-mono border-t" style={{ borderColor: 'var(--border-primary)' }}>
                            {r.logs.map((l, j) => (
                              <div key={j} className="flex gap-2" style={{
                                color: l.level === 'error' ? '#ef4444' : l.level === 'warn' ? '#f59e0b' : 'var(--text-secondary)',
                              }}>
                                <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                                <span className="flex-1">{l.message}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function FlowNodeAdder({ onAdd }: { onAdd: (type: NodeType, subtype: string) => void }) {
  const subs: FlowType[] = ['source', 'gate', 'sink'];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {subs.map((s) => (
        <Btn key={s} sub={s} onClick={() => onAdd('flow', s)} />
      ))}
    </div>
  );
}

function NodeAdder({ onAdd, hasTrigger }: { onAdd: (type: NodeType, subtype: string) => void; hasTrigger: boolean }) {
  const t = useTranslations();
  const triggers: TriggerType[] = ['manual', 'cell-changed', 'row-added', 'schedule', 'playtest-started', 'playtest-ended'];
  const conditions: ConditionType[] = ['compare', 'threshold', 'branch'];
  const actions: ActionType[] = ['notify', 'update-cell', 'log', 'webhook', 'delay', 'loop-rows', 'calc', 'snapshot-stats', 'create-retro-task'];

  return (
    <div className="space-y-1.5">
      {!hasTrigger && (
        <Section label={t('automations.sectionTrigger')}>
          {triggers.map((t) => <Btn key={t} sub={t} onClick={() => onAdd('trigger', t)} />)}
        </Section>
      )}
      <Section label={t('automations.sectionCondition')}>
        {conditions.map((t) => <Btn key={t} sub={t} onClick={() => onAdd('condition', t)} />)}
      </Section>
      <Section label={t('automations.sectionAction')}>
        {actions.map((t) => <Btn key={t} sub={t} onClick={() => onAdd('action', t)} />)}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-caption w-12" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}

function Btn({ sub, onClick }: { sub: string; onClick: () => void }) {
  const Icon = SUBTYPE_ICON[sub] ?? Zap;
  return (
    <button
      onClick={onClick}
      className="text-caption flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
    >
      <Icon size={10} />
      {SUBTYPE_LABELS[sub]}
    </button>
  );
}

function NodeCard({
  node, project, onUpdate, onRemove,
}: {
  node: AutomationNode;
  project: import('@/types').Project | null | undefined;
  onUpdate: (patch: Partial<AutomationNode>) => void;
  onRemove: () => void;
}) {
  const Icon = SUBTYPE_ICON[node.subtype] ?? Zap;
  const typeColor = (() => {
    if (node.type === 'trigger') return '#3b82f6';
    if (node.type === 'condition') return '#f59e0b';
    if (node.type === 'action') return '#10b981';
    // flow
    if (node.subtype === 'source') return '#06b6d4';
    if (node.subtype === 'gate') return '#8b5cf6';
    if (node.subtype === 'sink') return '#ec4899';
    return '#94a3b8';
  })();

  return (
    <div className="rounded border" style={{ borderColor: typeColor, background: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-2 p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <Icon size={12} style={{ color: typeColor }} />
        <span className="text-caption font-semibold flex-1" style={{ color: typeColor }}>
          {node.type.toUpperCase()}: {SUBTYPE_LABELS[node.subtype] ?? node.subtype}
        </span>
        <button onClick={onRemove} className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]">
          <Trash2 size={10} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      <div className="p-2">
        <NodeConfigEditor node={node} project={project} onChange={(config) => onUpdate({ config })} />
      </div>
    </div>
  );
}

function NodeConfigEditor({
  node, project, onChange,
}: {
  node: AutomationNode;
  project: import('@/types').Project | null | undefined;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const t = useTranslations();
  const cfg = node.config;
  const sheets = project?.sheets ?? [];
  const setCfg = (patch: Record<string, unknown>) => onChange({ ...cfg, ...patch });

  if (node.subtype === 'manual') {
    const t = useTranslations();
    return <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>{t('automations.noConfig')}</p>;
  }

  // Flow nodes
  if (node.subtype === 'source') {
    const t = useTranslations();
    return (
      <Field label={t('automations.fOccurrence')}>
        <input
          type="number"
          value={(cfg.rate as number) ?? 100}
          onChange={(e) => setCfg({ rate: parseFloat(e.target.value) || 0 })}
          className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }
  if (node.subtype === 'gate') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fProbability')}>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={(cfg.probability as number) ?? 0.5}
            onChange={(e) => setCfg({ probability: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)' }}
          />
        </Field>
        <Field label={t('automations.fMultiplier')}>
          <input
            type="number"
            step={0.1}
            value={(cfg.multiplier as number) ?? 1}
            onChange={(e) => setCfg({ multiplier: parseFloat(e.target.value) || 1 })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)' }}
          />
        </Field>
      </div>
    );
  }
  if (node.subtype === 'sink') {
    return (
      <Field label={t('automations.fLabel')}>
        <input
          value={(cfg.label as string) ?? ''}
          onChange={(e) => setCfg({ label: e.target.value })}
          className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'cell-changed' || node.subtype === 'row-added') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={cfg.sheetId as string} sheets={sheets} onChange={(v) => setCfg({ sheetId: v })} />
        </Field>
        {node.subtype === 'cell-changed' && (
          <Field label={t('automations.fColumn')}>
            <ColumnSelect sheets={sheets} sheetId={cfg.sheetId as string} value={cfg.column as string} onChange={(v) => setCfg({ column: v })} />
          </Field>
        )}
      </div>
    );
  }

  if (node.subtype === 'compare') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={cfg.sheetId as string} sheets={sheets} onChange={(v) => setCfg({ sheetId: v })} />
        </Field>
        <Field label={t('automations.fColumn')}>
          <ColumnSelect sheets={sheets} sheetId={cfg.sheetId as string} value={cfg.column as string} onChange={(v) => setCfg({ column: v })} />
        </Field>
        <Field label={t('automations.fOp')}>
          <Select value={(cfg.op as string) ?? 'gt'} onChange={(v) => setCfg({ op: v })} options={[
            { value: 'gt', label: '>' },
            { value: 'lt', label: '<' },
            { value: 'gte', label: '≥' },
            { value: 'lte', label: '≤' },
            { value: 'eq', label: '=' },
            { value: 'neq', label: '≠' },
            { value: 'contains', label: 'contains' },
          ]} />
        </Field>
        <Field label={t('automations.fValue')}>
          <input
            value={String(cfg.value ?? '')}
            onChange={(e) => setCfg({ value: e.target.value })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'threshold') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={cfg.sheetId as string} sheets={sheets} onChange={(v) => setCfg({ sheetId: v })} />
        </Field>
        <Field label={t('automations.fColumn')}>
          <ColumnSelect sheets={sheets} sheetId={cfg.sheetId as string} value={cfg.column as string} onChange={(v) => setCfg({ column: v })} />
        </Field>
        <Field label={t('automations.fAggregate')}>
          <Select value={(cfg.agg as string) ?? 'avg'} onChange={(v) => setCfg({ agg: v })} options={[
            { value: 'sum', label: t('automations.aggS_sum') }, { value: 'avg', label: t('automations.aggS_avg') },
            { value: 'min', label: t('automations.aggS_min') }, { value: 'max', label: t('automations.aggS_max') },
            { value: 'count', label: t('automations.aggS_count') },
          ]} />
        </Field>
        <Field label={t('automations.fThreshold')}>
          <input
            type="number"
            value={(cfg.threshold as number) ?? 0}
            onChange={(e) => setCfg({ threshold: parseFloat(e.target.value) || 0 })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'notify' || node.subtype === 'log') {
    return (
      <Field label={t('automations.fMessage')}>
        <input
          value={(cfg.message as string) ?? ''}
          onChange={(e) => setCfg({ message: e.target.value })}
          className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'update-cell') {
    const sheet = sheets.find((s) => s.id === (cfg.sheetId as string));
    return (
      <div className="space-y-1">
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={cfg.sheetId as string} sheets={sheets} onChange={(v) => setCfg({ sheetId: v, rowId: '', columnId: '' })} />
        </Field>
        <Field label={t('automations.fRow')}>
          <Select
            value={(cfg.rowId as string) ?? ''}
            onChange={(v) => setCfg({ rowId: v })}
            options={[{ value: '', label: '-' }, ...(sheet?.rows.map((r, i) => ({ value: r.id, label: `Row ${i + 1}` })) ?? [])]}
          />
        </Field>
        <Field label={t('automations.fColumn')}>
          <Select
            value={(cfg.columnId as string) ?? ''}
            onChange={(v) => setCfg({ columnId: v })}
            options={[{ value: '', label: '-' }, ...(sheet?.columns.map((c) => ({ value: c.id, label: c.name })) ?? [])]}
          />
        </Field>
        <Field label={t('automations.fValue')}>
          <input
            value={String(cfg.value ?? '')}
            onChange={(e) => setCfg({ value: e.target.value })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'webhook') {
    return (
      <div className="space-y-1">
        <Field label="URL">
          <input
            value={(cfg.url as string) ?? ''}
            onChange={(e) => setCfg({ url: e.target.value })}
            placeholder="https://..."
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label="Body">
          <textarea
            value={(cfg.body as string) ?? ''}
            onChange={(e) => setCfg({ body: e.target.value })}
            placeholder='{"key": "value"}'
            rows={2}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono resize-none"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'delay') {
    return (
      <Field label={t('automations.fDelayMs')}>
        <input
          type="number"
          value={Number(cfg.ms ?? 1000)}
          onChange={(e) => setCfg({ ms: Number(e.target.value) })}
          className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'loop-rows') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fSheet')}>
          <SheetSelect
            value={(cfg.sheetId as string) ?? ''}
            sheets={sheets}
            onChange={(v) => setCfg({ sheetId: v })}
          />
        </Field>
        <Field label={t('automations.fMaxRows')}>
          <input
            type="number"
            value={Number(cfg.limit ?? 100)}
            onChange={(e) => setCfg({ limit: Number(e.target.value) })}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'calc') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fFormula')}>
          <input
            value={(cfg.expr as string) ?? ''}
            onChange={(e) => setCfg({ expr: e.target.value })}
            placeholder={t('automations.fFormulaPlaceholder')}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label={t('automations.fLabel')}>
          <input
            value={(cfg.label as string) ?? ''}
            onChange={(e) => setCfg({ label: e.target.value })}
            placeholder={t('automations.fResultLabelPlaceholder')}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  if (node.subtype === 'schedule') {
    return (
      <Field label={t('automations.fEveryNMin')}>
        <input
          type="number"
          value={Number(cfg.intervalMin ?? 60)}
          onChange={(e) => setCfg({ intervalMin: Number(e.target.value) })}
          className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent font-mono"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </Field>
    );
  }

  if (node.subtype === 'branch') {
    return (
      <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
        {t('automations.branchNote1')}
        {t('automations.branchNote2')}
      </p>
    );
  }

  if (node.subtype === 'snapshot-stats') {
    // source row stats 를 target 셀(stat-snapshot 타입 권장)에 JSON 저장.
    // source/target 미지정 시 트리거 시점 컨텍스트(playtest 등)에서 채움.
    const sourceSheet = sheets.find((s) => s.id === (cfg.sourceSheetId as string));
    const targetSheet = sheets.find((s) => s.id === (cfg.targetSheetId as string));
    return (
      <div className="space-y-1">
        <div className="text-caption font-semibold pt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('automations.sourceLabel')}</div>
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={(cfg.sourceSheetId as string) ?? ''} sheets={sheets} onChange={(v) => setCfg({ sourceSheetId: v, sourceRowId: '' })} />
        </Field>
        <Field label={t('automations.fRow')}>
          <Select
            value={(cfg.sourceRowId as string) ?? ''}
            onChange={(v) => setCfg({ sourceRowId: v })}
            options={[{ value: '', label: t('automations.useTriggerContext') }, ...(sourceSheet?.rows.map((r, i) => ({ value: r.id, label: t('automations.rowLabel', { n: i + 1 }) })) ?? [])]}
          />
        </Field>
        <div className="text-caption font-semibold pt-1.5" style={{ color: 'var(--text-secondary)' }}>{t('automations.targetLabel')}</div>
        <Field label={t('automations.fSheet')}>
          <SheetSelect value={(cfg.targetSheetId as string) ?? ''} sheets={sheets} onChange={(v) => setCfg({ targetSheetId: v, targetRowId: '', targetColumnId: '' })} />
        </Field>
        <Field label={t('automations.fRow')}>
          <Select
            value={(cfg.targetRowId as string) ?? ''}
            onChange={(v) => setCfg({ targetRowId: v })}
            options={[{ value: '', label: '-' }, ...(targetSheet?.rows.map((r, i) => ({ value: r.id, label: `Row ${i + 1}` })) ?? [])]}
          />
        </Field>
        <Field label={t('automations.fColumn')}>
          <Select
            value={(cfg.targetColumnId as string) ?? ''}
            onChange={(v) => setCfg({ targetColumnId: v })}
            options={[
              { value: '', label: '-' },
              ...(targetSheet?.columns.map((c) => ({
                value: c.id,
                label: c.type === 'stat-snapshot' ? `${c.name} (snapshot)` : c.name,
              })) ?? []),
            ]}
          />
        </Field>
        <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          {t('automations.snapshotNote')}
        </p>
      </div>
    );
  }

  if (node.subtype === 'create-retro-task') {
    return (
      <div className="space-y-1">
        <Field label={t('automations.fTitle')}>
          <input
            value={(cfg.title as string) ?? ''}
            onChange={(e) => setCfg({ title: e.target.value })}
            placeholder={t('automations.fTitlePlaceholder')}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
        <Field label={t('automations.fContent')}>
          <textarea
            value={(cfg.description as string) ?? ''}
            onChange={(e) => setCfg({ description: e.target.value })}
            placeholder={t('automations.fContentPlaceholder')}
            rows={2}
            className="w-full px-1.5 py-0.5 text-caption rounded border bg-transparent resize-none"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </Field>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-caption w-12 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// 로컬 Select 제거 — @/components/ui/Select (커스텀 드롭다운) 사용.

function SheetSelect({
  value, sheets, onChange,
}: {
  value: string;
  sheets: Array<{ id: string; name: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={[{ value: '', label: '-' }, ...sheets.map((s) => ({ value: s.id, label: s.name }))]}
    />
  );
}

function ColumnSelect({
  sheets, sheetId, value, onChange,
}: {
  sheets: Array<{ id: string; name: string; columns: Array<{ id: string; name: string }> }>;
  sheetId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const sheet = sheets.find((s) => s.id === sheetId);
  return (
    <Select
      value={value}
      onChange={onChange}
      options={[{ value: '', label: '-' }, ...(sheet?.columns.map((c) => ({ value: c.name, label: c.name })) ?? [])]}
    />
  );
}
