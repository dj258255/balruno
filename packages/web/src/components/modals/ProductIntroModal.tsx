/**
 * ProductIntro 모달 — 5 슬라이드로 "왜 Balruno / 언제 / 하루 흐름 / 데이터 / 시각화".
 *
 * 첫 진입 유저가 "이 툴 왜 있고 어떻게 쓰지?" 알게 하는 온보딩 스토리텔링.
 * 기능 나열이 아니라 **실제 스튜디오의 하루** 시나리오 기반.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Zap,
  Sparkles,
  FileSpreadsheet,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { useProductIntro } from '@/stores/productIntroStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTranslations } from 'next-intl';

interface Slide {
  icon: typeof Zap;
  accent: string;
  title: string;
  subtitle: string;
  body: React.ReactNode;
}

function useSlides(t: ReturnType<typeof useTranslations>): Slide[] {
  const bold = (chunks: React.ReactNode) => <b>{chunks}</b>;
  return [
    {
      icon: Layers,
      accent: '#ef4444',
      title: t('productIntro.slide1Title'),
      subtitle: t('productIntro.slide1Subtitle'),
      body: (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('productIntro.slide1Lead')}
          </p>
          <ol className="space-y-1.5 text-sm list-decimal list-inside" style={{ color: 'var(--text-primary)' }}>
            <li>{t('productIntro.slide1Step1')}</li>
            <li>{t('productIntro.slide1Step2')}</li>
            <li>{t('productIntro.slide1Step3')}</li>
            <li>{t('productIntro.slide1Step4')}</li>
            <li>{t('productIntro.slide1Step5')}</li>
            <li>{t('productIntro.slide1Step6')}</li>
            <li>{t('productIntro.slide1Step7')}</li>
          </ol>
          <p className="text-sm font-medium mt-2" style={{ color: 'var(--danger)' }}>
            {t('productIntro.slide1Note')}
          </p>
        </div>
      ),
    },
    {
      icon: Zap,
      accent: '#3b82f6',
      title: t('productIntro.slide2Title'),
      subtitle: t('productIntro.slide2Subtitle'),
      body: (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{t.rich('productIntro.slide2HpEdit', { b: bold })}</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{t.rich('productIntro.slide2Reason', { b: bold })}</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{t.rich('productIntro.slide2Engine', { b: bold })}</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{t.rich('productIntro.slide2Playtest', { b: bold })}</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>{t.rich('productIntro.slide2History', { b: bold })}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Sparkles,
      accent: '#10b981',
      title: t('productIntro.slide3Title'),
      subtitle: t('productIntro.slide3Subtitle'),
      body: (
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <DaySlot time="09:30" text={t('productIntro.slide3Day930')} />
          <DaySlot time="10:00" text={t('productIntro.slide3Day1000')} />
          <DaySlot time="10:30" text={t('productIntro.slide3Day1100')} />
          <DaySlot time="11:30" text={t('productIntro.slide3Day1130')} />
          <DaySlot time="14:00" text={t('productIntro.slide3Day1400')} />
          <DaySlot time="17:00" text={t('productIntro.slide3Day1700')} />
        </div>
      ),
    },
    {
      icon: FileSpreadsheet,
      accent: '#8b5cf6',
      title: t('productIntro.slide4Title'),
      subtitle: t('productIntro.slide4Subtitle'),
      body: (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide4InputTitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('productIntro.slide4InputDesc')}
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide4EditTitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('productIntro.slide4EditDesc')}
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide4ConvertTitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Unity ScriptableObject · Unreal DataTable · Godot Resource · Bevy · TypeScript · JSON / CSV
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      accent: '#f59e0b',
      title: t('productIntro.slide5Title'),
      subtitle: t('productIntro.slide5Subtitle'),
      body: (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide5LayerATitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Grid · Form · Kanban · Calendar · Gallery · Gantt · Diagram
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide5LayerBTitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('productIntro.slide5LayerBDesc')}
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('productIntro.slide5LayerCTitle')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('productIntro.slide5LayerCDesc')}
            </p>
          </div>
        </div>
      ),
    },
  ];
}

function DaySlot({ time, text }: { time: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="text-caption font-mono px-1.5 py-0.5 rounded shrink-0 mt-0.5"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
      >
        {time}
      </span>
      <span style={{ color: 'var(--text-primary)' }}>{text}</span>
    </div>
  );
}

export default function ProductIntroModal() {
  const t = useTranslations();
  const open = useProductIntro((s) => s.open);
  const closeIntro = useProductIntro((s) => s.closeIntro);
  const markSeen = useProductIntro((s) => s.markSeen);
  const createFromSample = useProjectStore((s) => s.createFromSample);
  const [index, setIndex] = useState(0);
  const slides = useSlides(t);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const close = useCallback(() => {
    markSeen();
    closeIntro();
  }, [markSeen, closeIntro]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, slides.length]);

  if (!open) return null;

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const startWithSample = () => {
    createFromSample('rpg-character', t('samples.rpgCharacter.name'), t);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          maxHeight: 'calc(100vh - 48px)',
        }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)] z-10"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label={t('productIntro.closeAria')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 프로그레스 바 */}
        <div
          className="h-1 shrink-0"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((index + 1) / slides.length) * 100}%`,
              background: slide.accent,
            }}
          />
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-8 pb-6">
          <div className="flex items-start gap-4 mb-5">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${slide.accent}20` }}
            >
              <slide.icon className="w-6 h-6" style={{ color: slide.accent }} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {slide.title}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {slide.subtitle}
              </p>
            </div>
          </div>

          <div>{slide.body}</div>
        </div>

        {/* Footer — 진행 · CTA */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md transition-colors"
            style={{
              color: 'var(--text-secondary)',
              opacity: index === 0 ? 0.4 : 1,
              cursor: index === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t('productIntro.previous')}
          </button>

          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background: i === index ? slide.accent : 'var(--border-primary)',
                  transform: i === index ? 'scale(1.5)' : 'scale(1)',
                }}
                aria-label={t('productIntro.slideAria', { n: i + 1 })}
              />
            ))}
          </div>

          {isLast ? (
            <button
              type="button"
              onClick={startWithSample}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md"
              style={{ background: slide.accent, color: 'white' }}
            >
              {t('productIntro.rpgSampleStart')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md"
              style={{ background: slide.accent, color: 'white' }}
            >
              {t('productIntro.next')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
