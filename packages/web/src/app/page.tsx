'use client';

/**
 * Root marketing landing — Baserow / Linear / Notion / Vercel pattern.
 * Hero with tagline + dual CTA + fake-sheet illustration, feature
 * blocks, 10-view grid, integrations, pricing teaser, OSS callout,
 * footer.
 *
 * Authenticated visitors skip the landing entirely:
 *   - last-visited workspace+project (localStorage hint written by the
 *     workspace and project pages) → direct jump
 *   - otherwise → /workspaces, which auto-routes from there
 *
 * 'idle' and 'loading' states show a minimal loader so the page
 * doesn't flash 'sign up' to a logged-in visitor before the cookie
 * probe resolves.
 *
 * Previously this slot held an Excalidraw-style anonymous demo
 * (ADR 0035); reverted on 2026-05-08 in favour of landing-first
 * onboarding to avoid the spam / vandalism load on a shared
 * anonymous workspace.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Github,
  LayoutGrid,
  MessageSquare,
  Plug,
  Sparkles,
  Code2,
} from 'lucide-react';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

export default function Home() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    if (status !== 'authenticated') return;

    if (typeof window !== 'undefined') {
      const lastWs = window.localStorage.getItem('balruno:lastWorkspace');
      const lastProj = lastWs
        ? window.localStorage.getItem(`balruno:lastProject:${lastWs}`)
        : null;
      if (lastWs && lastProj) {
        router.replace(`/${lastWs}/projects/${lastProj}`);
        return;
      }
    }
    router.replace('/workspaces');
  }, [status, router]);

  if (status === 'idle' || status === 'loading' || status === 'authenticated') {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
      >
        <p className="text-sm">로딩 중…</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <Header />
      <Hero />
      <Features />
      <Views />
      <Integrations />
      <PricingTeaser />
      <OpenSource />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: 'var(--border-primary)', background: 'rgba(255,255,255,0.7)' }}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          <span className="text-lg">★</span> Balruno
        </Link>
        <nav className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <a
            href="https://github.com/dj258255/balruno"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p
            className="mb-4 inline-block rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            Open source · MIT frontend · AGPL backend
          </p>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            게임 스튜디오를 위한
            <br />
            <span style={{ color: 'var(--accent)' }}>스프레드시트 + 협업 도구</span>
          </h1>
          <p className="mb-8 text-lg" style={{ color: 'var(--text-secondary)' }}>
            밸런스 데이터, 애자일 티켓, 에픽 로드맵을 한 곳에서. 실시간 동기화 + 코멘트 + GitHub/Discord 통합 + Curve / Heatmap / Probability 뷰까지 모두 무료로 self-host 가능.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              무료로 시작 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              요금제 보기
            </Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            카드 등록 없음 · 14일 freemium · 언제든 self-host 로 이전 가능
          </p>
        </div>
        <div
          className="relative aspect-video overflow-hidden rounded-lg border shadow-2xl"
          style={{
            borderColor: 'var(--border-primary)',
            background:
              'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 50%, rgba(236,72,153,0.10) 100%)',
          }}
        >
          {/* Hero illustration placeholder — fakes a sheet UI without
              the cost of a real screenshot. Replace with PNG once the
              UI stops shifting weekly. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid w-full max-w-md grid-cols-4 gap-px p-6" style={{ background: 'var(--bg-primary)', opacity: 0.95 }}>
              {['Class', 'HP', 'STR', 'AGI'].map((h) => (
                <div key={h} className="border bg-[var(--bg-secondary)] p-2 text-center text-xs font-medium" style={{ borderColor: 'var(--border-primary)' }}>
                  {h}
                </div>
              ))}
              {[
                ['Knight', '120', '15', '8'],
                ['Mage', '60', '5', '10'],
                ['Archer', '80', '10', '15'],
                ['Cleric', '90', '8', '7'],
              ].flatMap((row, i) =>
                row.map((cell, j) => (
                  <div
                    key={`${i}-${j}`}
                    className="border bg-[var(--bg-primary)] p-2 text-center text-xs"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                  >
                    {cell}
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: LayoutGrid,
      title: '10가지 뷰',
      desc: 'Grid · Form · Kanban · Calendar · Gallery · Gantt · Heatmap · Curve · Probability · Diff. 마지막 4개는 게임 밸런싱 도메인 전용 — Notion / Airtable 에 없음.',
    },
    {
      icon: MessageSquare,
      title: '실시간 협업',
      desc: '셀 + 문서 본문 코멘트, 범위 핀 하이라이트, 답글 스레드, @멘션 + 인박스, 이메일 + Web Push 알림.',
    },
    {
      icon: Plug,
      title: '외부 통합',
      desc: 'GitHub PR / 이슈 inbound + 외부로 outbound 웹훅 (HMAC-SHA256), Discord 슬래시 명령, 공유 링크 (per-view).',
    },
    {
      icon: Code2,
      title: '게임 엔진 export',
      desc: 'CSV (RFC 4180 + UTF-8 BOM), C# `[Serializable]` struct + readonly array. Unity / Godot Assets/ 에 그대로 드롭.',
    },
    {
      icon: Sparkles,
      title: '게임 밸런싱 수식',
      desc: 'DPS · EHP · TTK · SCALE · DIMINISH · REF — mathjs + formulajs 위에 게임 도메인 헬퍼 빌트인.',
    },
  ];
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-3 text-3xl font-bold">왜 Balruno?</h2>
        <p className="mb-12 text-base" style={{ color: 'var(--text-secondary)' }}>
          게임 디자이너의 일상에 맞춰 만든 도구 — 10가지 뷰 + 실시간 협업 + 외부 통합 + 엔진 export.
        </p>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className="rounded-lg border p-6"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <Icon className="mb-3 h-6 w-6" style={{ color: 'var(--accent)' }} />
                <h3 className="mb-2 text-lg font-semibold">{it.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {it.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Views() {
  const views = [
    'Grid', 'Form', 'Kanban', 'Calendar',
    'Gallery', 'Gantt', 'Heatmap', 'Curve',
    'Probability', 'Diff',
  ];
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-3 text-3xl font-bold">한 시트, 10가지 뷰</h2>
        <p className="mb-8 text-base" style={{ color: 'var(--text-secondary)' }}>
          같은 데이터를 sprint board (Kanban), playtest schedule (Calendar), epic roadmap (Gantt), level scaling 곡선 (Curve), 캐릭터 × 스탯 매트릭스 (Heatmap), 가챠 트리 (Probability) 으로 바로 전환.
        </p>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {views.map((v) => (
            <div
              key={v}
              className="rounded-md border px-3 py-4 text-center text-sm font-medium"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              {v}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  const items = [
    'GitHub PR / 이슈 → 시트에 자동 row 추가',
    'Discord /balruno bug "..." 슬래시 명령',
    'Outbound 웹훅 (comment.added / mention.created / row.added)',
    'Email (SMTP) + Web Push (VAPID, 영구 무료)',
    '공유 링크 (per view, instant revoke)',
    'CSV / C# struct 다운로드',
  ];
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-3 text-3xl font-bold">기존 워크플로 와 연결</h2>
        <p className="mb-8 text-base" style={{ color: 'var(--text-secondary)' }}>
          GitHub / Discord / Slack / Notion 끊지 말고 Balruno 와 양방향. *데이터 lock-in 없음* — 언제든 CSV / JSON 으로 내보내기.
        </p>
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="text-base" style={{ color: 'var(--accent)' }}>·</span>
              {it}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PricingTeaser() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      desc: '1인 / 사이드 프로젝트 충분',
      bullets: ['rows/sheet 2k', 'history 14일', '120분 server-backed undo', 'BYOK AI'],
    },
    {
      name: 'Pro',
      price: '$10/mo',
      desc: '소규모 팀',
      bullets: ['unlimited rows', 'history 90일', 'cloud AI pool (선택)'],
    },
    {
      name: 'Team',
      price: '$18/mo',
      desc: '여러 워크스페이스 + 감사 로그',
      bullets: ['SSO', '30일 audit log retention', 'audit log export'],
    },
  ];
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-3 text-3xl font-bold">간단한 요금제</h2>
        <p className="mb-8 text-base" style={{ color: 'var(--text-secondary)' }}>
          self-host 하면 영원히 무료. cloud 호스팅도 freemium. *카드 등록 없음, 언제든 데이터 export*.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="rounded-lg border p-6"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <h3 className="mb-1 text-lg font-semibold">{t.name}</h3>
              <p className="mb-3 text-2xl font-bold">{t.price}</p>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t.desc}
              </p>
              <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t.bullets.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm">
          <Link href="/pricing" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
            전체 가격 비교 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function OpenSource() {
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="mb-3 text-3xl font-bold">Open source 입니다</h2>
        <p className="mb-6 text-base" style={{ color: 'var(--text-secondary)' }}>
          Frontend (MIT) + Backend (AGPL v3) + Hosted SaaS — AFFiNE / Outline 패턴. <br />
          self-host 하면 카드 등록 / 사용자 수 제한 / 데이터 export 제한 없음.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://github.com/dj258255/balruno"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <Github className="h-4 w-4" /> GitHub 에서 보기
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <div>© 2026 Balruno · 1인 OSS 프로젝트</div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <a href="https://github.com/dj258255/balruno" target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
        </nav>
      </div>
    </footer>
  );
}
