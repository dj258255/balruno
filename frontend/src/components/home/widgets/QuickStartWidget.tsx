'use client';

/**
 * 빠른 시작 위젯 — AI / 템플릿 / Excel 임포트 / 새 프로젝트.
 */

import { Sparkles, Wand2, FolderPlus, FileSpreadsheet, Bot } from 'lucide-react';

interface ActionProps {
  icon: typeof Sparkles;
  color: string;
  label: string;
  desc: string;
  onClick: () => void;
}

function Action({ icon: Icon, color, label, desc, onClick }: ActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

export default function QuickStartWidget() {
  return (
    <div
      className="glass-card p-4"
      style={{ borderLeft: '3px solid #8b5cf6' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: '#8b5cf6' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          빠른 시작
        </h3>
      </div>
      <div className="space-y-1">
        <Action
          icon={Bot}
          color="#a855f7"
          label="AI Copilot 열기"
          desc="프로젝트 컨텍스트로 질문"
          onClick={() => window.dispatchEvent(new Event('balruno:open-ai-copilot'))}
        />
        <Action
          icon={Wand2}
          color="#8b5cf6"
          label="AI 로 시작"
          desc="요구사항 → 자동 생성"
          onClick={() => window.dispatchEvent(new Event('balruno:open-ai-setup'))}
        />
        <Action
          icon={FolderPlus}
          color="#3b82f6"
          label="템플릿 갤러리"
          desc="RPG · FPS · 팀 PM"
          onClick={() => window.dispatchEvent(new Event('balruno:open-gallery'))}
        />
        <Action
          icon={FileSpreadsheet}
          color="#10b981"
          label="Excel 가져오기"
          desc="기존 시트에서 시작"
          onClick={() => window.dispatchEvent(new Event('balruno:open-import-modal'))}
        />
      </div>
    </div>
  );
}
