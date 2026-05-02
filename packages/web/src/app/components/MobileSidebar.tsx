'use client';

import { Sidebar } from '@/components/layout';

interface SidebarCallbacks {
  onShowChart: () => void;
  onShowHelp: () => void;
  onShowCalculator: () => void;
  onShowComparison: () => void;
  onShowReferences: () => void;
  onShowPresetComparison?: () => void;
  onShowImbalanceDetector?: () => void;
  onShowGoalSolver?: () => void;
  onShowBalanceAnalysis?: () => void;
  onShowEconomy?: () => void;
  onShowDpsVariance?: () => void;
  onShowCurveFitting?: () => void;
  onShowSettings?: () => void;
  onShowExportModal?: () => void;
  onShowImportModal?: () => void;
  onToggleFormulaHelper?: () => void;
  onToggleBalanceValidator?: () => void;
  onToggleDifficultyCurve?: () => void;
  onToggleSimulation?: () => void;
  onToggleEntityDefinition?: () => void;
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  callbacks: SidebarCallbacks;
  activeTools?: {
    calculator?: boolean;
    comparison?: boolean;
    chart?: boolean;
    presetComparison?: boolean;
    imbalanceDetector?: boolean;
    goalSolver?: boolean;
    balanceAnalysis?: boolean;
    economy?: boolean;
    dpsVariance?: boolean;
    curveFitting?: boolean;
    formulaHelper?: boolean;
    balanceValidator?: boolean;
    difficultyCurve?: boolean;
    simulation?: boolean;
    entityDefinition?: boolean;
  };
}

export default function MobileSidebar({ isOpen, onClose, callbacks, activeTools }: MobileSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute left-0 top-0 bottom-0 w-72 animate-slideIn"
        onClick={(e) => e.stopPropagation()}
      >
        <Sidebar {...callbacks} activeTools={activeTools} />
      </div>
    </div>
  );
}
