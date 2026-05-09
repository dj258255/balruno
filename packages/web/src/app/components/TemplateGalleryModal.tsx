'use client';

/**
 * TemplateGalleryModal — choose between an empty project and the
 * ADR 0020 starter pack on first project creation.
 *
 * Listens for the `balruno:open-gallery` window event that the
 * sidebar's NewProjectForm / SidebarQuickAccess / ProjectList /
 * EmptyProjectsCTA already dispatch. Mounted from WorkspaceShell so
 * a single instance covers the whole workspace surface.
 *
 * <p>Two cards on purpose. The starter-pack catalogue today is
 * server-side and seeds the same default bundle no matter which
 * starter id the UI hints at — pretending each of the 12 starters
 * is its own option would be a false promise. Instead, the
 * recommended-starter card previews the 12 entries as a visual hint
 * of what gets seeded, and the empty card seeds an unconfigured
 * project. When the backend grows a per-starter contract, this
 * modal can split the second card into 12 cards without touching
 * the wiring.</p>
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FilePlus2, Loader2, Sparkles, X } from 'lucide-react';

import { createProject } from '@/lib/backend';
import { randomId } from '@/lib/uuid';
import { STARTER_CATALOG } from '@/lib/starterPack';

interface Props {
  workspaceId: string;
  workspaceSlug: string;
}

export default function TemplateGalleryModal({ workspaceId, workspaceSlug }: Props) {
  const router = useRouter();
  const tStarter = useTranslations('starterPack');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<'empty' | 'starter' | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('balruno:open-gallery', onOpen);
    return () => window.removeEventListener('balruno:open-gallery', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting]);

  const previews = useMemo(
    () =>
      STARTER_CATALOG
        .filter((s) => s.id !== 'blank')
        .map((s) => ({
          id: s.id,
          icon: s.icon,
          color: s.color,
          label: tStarter(`${s.i18nKey}.label`),
        })),
    [tStarter],
  );

  const create = async (kind: 'empty' | 'starter') => {
    if (submitting) return;
    setSubmitting(kind);
    const slug = 'p-' + randomId().replace(/-/g, '').slice(0, 8);
    const name = kind === 'starter' ? '내 첫 게임' : '새 프로젝트';
    try {
      const created = await createProject(workspaceId, {
        slug,
        name,
        withStarterPack: kind === 'starter',
      });
      setOpen(false);
      router.replace(`/${workspaceSlug}/projects/${created.slug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '프로젝트 생성 실패');
    } finally {
      setSubmitting(null);
    }
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={() => {
        if (!submitting) setOpen(false);
      }}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border shadow-xl"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              새 프로젝트 만들기
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              빈 프로젝트로 시작하거나, 추천 시작 팩으로 즉시 살아있는 데이터부터 시작하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && setOpen(false)}
            className="rounded-md p-1 hover:bg-[var(--bg-hover)]"
            aria-label="close"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: 'calc(85vh - 64px)' }}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              icon={<FilePlus2 className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />}
              title="빈 프로젝트"
              desc="아무 시트도 없이 시작합니다. 처음부터 직접 구조를 짜고 싶을 때."
              loading={submitting === 'empty'}
              disabled={!!submitting}
              onClick={() => create('empty')}
            />
            <Card
              icon={<Sparkles className="h-5 w-5" style={{ color: 'var(--accent)' }} />}
              title="추천 시작 팩"
              desc="캐릭터, 무기, EXP 곡선, 가챠, 스프린트 보드, 버그 트래커, 에픽 로드맵 등 12종이 미리 시드됩니다."
              loading={submitting === 'starter'}
              disabled={!!submitting}
              onClick={() => create('starter')}
              accent
            >
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {previews.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px]"
                      style={{
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-tertiary)',
                      }}
                      title={p.label}
                    >
                      <Icon className="h-4 w-4" style={{ color: p.color }} />
                      <span className="line-clamp-1 text-center">{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Card({
  icon,
  title,
  desc,
  onClick,
  loading,
  disabled,
  accent,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col gap-3 rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: accent ? 'var(--accent)' : 'var(--border-primary)',
        background: 'var(--bg-primary)',
        boxShadow: accent ? '0 0 0 1px var(--accent) inset' : undefined,
      }}
    >
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
        style={{
          background: accent
            ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
            : 'var(--bg-tertiary)',
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-secondary)' }} />
        ) : (
          icon
        )}
      </div>
      <div>
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {desc}
        </p>
      </div>
      {children}
    </button>
  );
}
