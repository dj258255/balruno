'use client';

/**
 * EconomyWorkbench — 경제 설계 통합 패널.
 *
 * 두 가지 시선을 한 패널에 결합:
 *  - "분석": Faucet/Sink 수치 + 인플레이션/공급 곡선 (기존 EconomyPanel 본문).
 *  - "다이어그램": Source/Pool/Gate/Converter/Sink 노드 그래프 + Monte Carlo (기존 DiagramView).
 *
 * 분리되어 있던 두 도구를 사용자가 하나의 워크벤치로 쓰도록 묶음.
 * 내부 데이터 모델은 당분간 독립 — 분석은 로컬 state, 다이어그램은 automations(mode='flow').
 * 향후 단일 EconomyDesign 모델로 통합할 수 있도록 경계를 얕게 둠.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { BarChart3, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/projectStore';

const EconomyPanel = dynamic(() => import('@/components/panels/EconomyPanel'), { ssr: false });
const DiagramView = dynamic(() => import('@/components/views/DiagramView'), { ssr: false });

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* 워크벤치 탭 */}
      <div
        role="tablist"
        aria-label="경제 워크벤치 모드"
        className="flex items-center gap-1 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <WorkbenchTab
          active={mode === 'analytics'}
          onClick={() => setMode('analytics')}
          icon={BarChart3}
          label="분석"
          hint="Faucet/Sink·인플레이션"
        />
        <WorkbenchTab
          active={mode === 'diagram'}
          onClick={() => setMode('diagram')}
          icon={Workflow}
          label="다이어그램"
          hint="Source → Pool → Sink 흐름"
        />
      </div>

      {/* 탭 컨텐츠 — 언마운트 하지 않고 display 토글해 상태 보존 */}
      <div className="flex-1 min-h-0 relative">
        <div className={cn('absolute inset-0 flex flex-col', mode === 'analytics' ? '' : 'hidden')}>
          <EconomyPanel onClose={onClose} />
        </div>
        <div className={cn('absolute inset-0 flex flex-col', mode === 'diagram' ? '' : 'hidden')}>
          {projectId && sheetId && sheet ? (
            <DiagramView projectId={projectId} sheet={sheet} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              시트를 선택하면 다이어그램이 로드됩니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkbenchTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors',
        active ? 'font-semibold' : 'hover:bg-[var(--bg-hover)]'
      )}
      style={{
        background: active ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
        · {hint}
      </span>
    </button>
  );
}
