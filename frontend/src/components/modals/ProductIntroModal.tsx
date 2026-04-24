'use client';

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
  return [
    {
      icon: Layers,
      accent: '#ef4444',
      title: '5 개 창 지옥',
      subtitle: '게임 스튜디오가 지금 매일 겪는 일',
      body: (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            보스 HP 800 → 1000 수정 하나 반영하려면:
          </p>
          <ol className="space-y-1.5 text-sm list-decimal list-inside" style={{ color: 'var(--text-primary)' }}>
            <li>Google Sheets 에서 수치 수정</li>
            <li>Confluence 에 이유 기록</li>
            <li>Jira 에 반영 티켓 생성</li>
            <li>Discord 에 멘션</li>
            <li>엔지니어가 CSV export → Unity import</li>
            <li>플레이테스트 결과가 또 Discord 로 흘러감</li>
            <li>어제 왜 1000 이었는지 기록 날아감</li>
          </ol>
          <p className="text-sm font-medium mt-2" style={{ color: 'var(--danger)' }}>
            5 개 툴 창 · 6 홉 · 변경 맥락 유실.
          </p>
        </div>
      ),
    },
    {
      icon: Zap,
      accent: '#3b82f6',
      title: '한 워크스페이스에서 연결',
      subtitle: 'Balruno 의 핵심 약속',
      body: (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>
                <b>HP 수정</b> = 시트 셀 하나 편집 (수식 자동 재계산)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>
                <b>변경 이유</b> = 셀 코멘트 + Epic 태스크 링크
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>
                <b>엔진 반영</b> = Export → Unity/Unreal/Godot 코드 생성
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>
                <b>플레이테스트</b> = 세션 시트 → 다시 밸런스 시트로 task-link
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#3b82f6' }}>•</span>
              <span>
                <b>변경 이력</b> = 자동 기록, Inbox 에 집약
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Sparkles,
      accent: '#10b981',
      title: '하루 흐름 — 10 명 인디 스튜디오',
      subtitle: '실제로 어떻게 쓰이는가',
      body: (
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <DaySlot time="09:30" text="각자 Home 에서 내 Sprint / Inbox 확인" />
          <DaySlot time="10:00" text="Kanban 뷰로 스탠드업 — Doing 열 공유" />
          <DaySlot
            time="10:30"
            text="밸런서: 캐릭터 시트에서 HP 편집 → Goal Solver 역산 → Monte Carlo → 시트에 저장"
          />
          <DaySlot time="11:30" text="엔지니어: Slack 자동 알림 받고 → Export → Unity 빌드" />
          <DaySlot time="14:00" text="플레이테스트 세션 기록 → 밸런스 시트에 task-link" />
          <DaySlot
            time="17:00"
            text="프로듀서: Current Cycle 위젯에서 미완료 이관 · Velocity 확인"
          />
        </div>
      ),
    },
    {
      icon: FileSpreadsheet,
      accent: '#8b5cf6',
      title: '데이터 — 입력 → 변환',
      subtitle: '모든 데이터는 시트 · 문서 · 분석 패널에',
      body: (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>입력</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Excel 식 셀 편집 · 수식 (한글 컬럼 참조 OK) · Form 뷰 · AI 수식 생성 · CSV/JSON import
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>편집</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              14 컬럼 타입. 게임 특화: task-link (행 연결) · stat-snapshot (밸런스 버전) · person (담당자 아바타)
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>변환 (game-data kind 한정)</p>
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
      title: '시각화 — 3 계층',
      subtitle: '같은 데이터를 여러 관점으로',
      body: (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>계층 A · 시트 내부 7 뷰</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Grid · Form · Kanban · Calendar · Gallery · Gantt · Diagram
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>계층 B · Home 대시보드</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Current Cycle · Burndown · Velocity · My Sprint · Recent Changes · 9 위젯
            </p>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>계층 C · 분석 패널 (우측 도킹)</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Monte Carlo · Goal Solver · Economy Simulator · DPS Variance · 30+ 게임 특화 툴
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
          aria-label="닫기"
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
            이전
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
                aria-label={`슬라이드 ${i + 1}`}
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
              RPG 샘플로 시작
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md"
              style={{ background: slide.accent, color: 'white' }}
            >
              다음
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
