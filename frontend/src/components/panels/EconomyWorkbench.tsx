'use client';

/**
 * EconomyWorkbench — 경제 설계 통합 패널.
 *
 * 두 가지 시선을 한 패널에 결합:
 *  - "분석": Faucet/Sink 수치 + 인플레이션/공급 곡선 (기존 EconomyPanel 본문).
 *  - "다이어그램": Source/Pool/Gate/Converter/Sink 노드 그래프 + Monte Carlo (기존 DiagramView).
 *
 * 두 탭은 하나의 economy automation 을 공유 — Faucet 추가/삭제/수정 시 다이어그램의
 * Source/Sink 노드가 자동 동기화. (origin='manual' 노드는 보호.)
 *
 * 탭 전환 시 비활성 탭은 언마운트 — 숨긴 채 유지하면 recharts ResponsiveContainer 가
 * 0×0 부모 안에서 차트를 못 그리는 경고가 발생함. 데이터는 design 핸들에 persist 되어
 * 보존됨.
 */

import { useState } from 'react';
import { BarChart3, Workflow } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useEconomyDesign } from '@/hooks/useEconomyDesign';
import EconomyPanel from '@/components/panels/EconomyPanel';
import DiagramView from '@/components/views/DiagramView';

type WorkbenchMode = 'analytics' | 'diagram';

interface Props {
  onClose?: () => void;
}

export default function EconomyWorkbench({ onClose }: Props) {
  const [mode, setMode] = useState<WorkbenchMode>('analytics');
  const projectId = useProjectStore((s) => s.currentProjectId);
  const sheetId = useProjectStore((s) => s.currentSheetId);
  const sheet = useProjectStore((s) => {
    if (!s.currentProjectId || !s.currentSheetId) return null;
    const project = s.projects.find((p) => p.id === s.currentProjectId);
    return project?.sheets.find((sh) => sh.id === s.currentSheetId) ?? null;
  });
  // 시트당 단일 economy automation. 분석 탭 ↔ 다이어그램 탭이 같은 핸들 공유.
  const design = useEconomyDesign(projectId, sheet?.name ?? null);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* 모드 선택 — SimulationPanel 1v1/팀 토글과 동일한 segmented control 패턴 */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <ModeSelector mode={mode} setMode={setMode} />
      </div>

      {/* 탭 컨텐츠 — 활성 탭만 마운트 (recharts 0×0 회피, 데이터는 design 에 persist) */}
      <div className="flex-1 min-h-0 flex flex-col">
        {mode === 'analytics' && (
          <EconomyPanel onClose={onClose} design={design} />
        )}
        {mode === 'diagram' && (
          projectId && sheetId && sheet ? (
            <DiagramView projectId={projectId} sheet={sheet} design={design} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              시트를 선택하면 다이어그램이 로드됩니다
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ModeSelector({
  mode,
  setMode,
}: {
  mode: WorkbenchMode;
  setMode: (m: WorkbenchMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="경제 워크벤치 모드"
      className="flex gap-1 p-1 rounded-lg"
      style={{ background: 'var(--bg-tertiary)' }}
    >
      <ModeButton
        active={mode === 'analytics'}
        onClick={() => setMode('analytics')}
        icon={BarChart3}
        label="분석"
      />
      <ModeButton
        active={mode === 'diagram'}
        onClick={() => setMode('diagram')}
        icon={Workflow}
        label="다이어그램"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
      style={{
        background: active ? 'var(--bg-primary)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
