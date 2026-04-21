'use client';

/**
 * Home 빈 상태 — 프로젝트 0개일 때.
 *
 * Canva 식 empty state: 바로 액션 가능한 CTA 3개.
 * 리서치: 가이드된 빈 상태 = 활성화 40→75%.
 */

import { Sparkles, FileSpreadsheet, FolderPlus, Wand2 } from 'lucide-react';

export default function HomeEmptyState() {
  const openAiSetup = () => window.dispatchEvent(new Event('balruno:open-ai-setup'));
  const openGallery = () => window.dispatchEvent(new Event('balruno:open-gallery'));
  const openImport = () => window.dispatchEvent(new Event('balruno:open-import-modal'));

  return (
    <div
      className="flex-1 overflow-y-auto p-6 sm:p-8 flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            시작해볼까요?
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            게임 밸런싱 · 스프린트 · 플레이테스트를 하나의 워크스페이스에서
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={openAiSetup}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #8b5cf6' }}
          >
            <Wand2 className="w-6 h-6 mb-2" style={{ color: '#8b5cf6' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              AI 로 시작
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              요구사항 설명 → 자동 생성
            </div>
          </button>

          <button
            onClick={openGallery}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #3b82f6' }}
          >
            <FolderPlus className="w-6 h-6 mb-2" style={{ color: '#3b82f6' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              템플릿 둘러보기
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              RPG · FPS · Idle · 팀 PM
            </div>
          </button>

          <button
            onClick={openImport}
            className="glass-card p-5 text-left hover:shadow-md transition-all"
            style={{ borderLeft: '3px solid #10b981' }}
          >
            <FileSpreadsheet className="w-6 h-6 mb-2" style={{ color: '#10b981' }} />
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Excel 가져오기
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              기존 시트에서 시작
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
