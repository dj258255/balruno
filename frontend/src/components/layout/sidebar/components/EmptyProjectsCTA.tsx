'use client';

/**
 * 프로젝트가 0 개일 때 사이드바 팀스페이스 섹션의 empty state.
 *
 * 기존: "프로젝트가 없습니다 · 새 프로젝트 만들기" 텍스트만.
 * 개선: 세 갈래 CTA — (1) 밸런싱 샘플, (2) 팀 PM 샘플, (3) 전체 갤러리.
 *
 * Airtable / Notion 공통 패턴 — 빈 화면 대신 "샘플로 바로 시작" 큰 카드.
 */

import { Swords, Kanban, LayoutTemplate, Plus, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { usePersona } from '@/stores/personaStore';

type CardId = 'balance' | 'pm' | 'gallery';

export function EmptyProjectsCTA() {
  const t = useTranslations();
  const createFromSample = useProjectStore((s) => s.createFromSample);
  const persona = usePersona((s) => s.persona);

  const startBalanceSample = () => {
    const name = t('samples.rpgCharacter.name');
    createFromSample('rpg-character', name, t);
  };

  const startPmSample = () => {
    const name = t('samples.sprintBoard.name');
    createFromSample('sprint-board', name, t);
  };

  const openGallery = () => {
    window.dispatchEvent(new Event('balruno:open-gallery'));
  };

  const openNewProject = () => {
    window.dispatchEvent(new Event('balruno:open-new-project'));
  };

  const cards: Record<CardId, React.ReactNode> = {
    balance: (
      <CtaCard
        key="balance"
        icon={Swords}
        iconBg="linear-gradient(135deg, #3b82f6, #6366f1)"
        title={t('sidebar.emptyCta.balance.title')}
        hint={t('sidebar.emptyCta.balance.hint')}
        onClick={startBalanceSample}
      />
    ),
    pm: (
      <CtaCard
        key="pm"
        icon={Kanban}
        iconBg="linear-gradient(135deg, #f59e0b, #ef4444)"
        title={t('sidebar.emptyCta.pm.title')}
        hint={t('sidebar.emptyCta.pm.hint')}
        onClick={startPmSample}
      />
    ),
    gallery: (
      <CtaCard
        key="gallery"
        icon={LayoutTemplate}
        iconBg="linear-gradient(135deg, #10b981, #14b8a6)"
        title={t('sidebar.emptyCta.gallery.title')}
        hint={t('sidebar.emptyCta.gallery.hint')}
        onClick={openGallery}
      />
    ),
  };

  // 페르소나 따라 카드 순서 조정. 분석가는 밸런싱 먼저 (수식·시뮬 가장 가까움).
  const order: CardId[] = (() => {
    switch (persona) {
      case 'pm':
        return ['pm', 'balance', 'gallery'];
      case 'balancer':
      case 'analyst':
        return ['balance', 'pm', 'gallery'];
      case 'explorer':
        return ['gallery', 'balance', 'pm'];
      default:
        return ['balance', 'pm', 'gallery'];
    }
  })();

  return (
    <div className="px-2 py-3 space-y-2">
      <div className="px-1.5 pb-1">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('sidebar.emptyCta.heading')}
        </p>
        <p className="text-caption mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {t('sidebar.emptyCta.subheading')}
        </p>
      </div>

      {order.map((id) => cards[id])}

      <button
        type="button"
        onClick={openNewProject}
        className="w-full flex items-center justify-center gap-1.5 mt-1 px-2 py-1.5 rounded-md text-caption transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Plus className="w-3 h-3" />
        {t('sidebar.emptyCta.blank')}
      </button>
    </div>
  );
}

function CtaCard({
  icon: Icon,
  iconBg,
  title,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all hover:shadow-sm"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-primary)';
      }}
    >
      <span
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: 'white' }} />
      </span>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
          {hint}
        </div>
      </div>
      <ArrowRight
        className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--accent)' }}
      />
    </button>
  );
}
