/**
 * Feedback hub modal — opened from the sidebar footer "피드백" button.
 *
 * Two parallel cards instead of a single Google-Forms link, so the
 * user can pick the channel that fits the moment:
 *   - Bug reports / structured product input → Google Forms
 *   - Casual chat / live debugging / community → Discord
 *
 * Both cards open in a new tab via plain anchor; the modal itself is
 * a portal so the sidebar transform doesn't clip its centred backdrop.
 */
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ExternalLink, MessageSquare, Hash, X } from 'lucide-react';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  feedbackFormUrl: string;
  discordUrl: string;
}

export function FeedbackModal({
  open,
  onClose,
  feedbackFormUrl,
  discordUrl,
}: FeedbackModalProps) {
  const t = useTranslations('feedback');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between px-6 pt-5 pb-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div>
            <h2
              id="feedback-modal-title"
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('modalTitle')}
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('modalSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6">
          <ChannelCard
            href={feedbackFormUrl}
            icon={<MessageSquare className="w-5 h-5" />}
            iconBg="var(--accent-light)"
            iconColor="var(--accent)"
            title={t('gformTitle')}
            description={t('gformDesc')}
            ctaText={t('gformCta')}
            onSelect={onClose}
          />
          <ChannelCard
            href={discordUrl}
            icon={<Hash className="w-5 h-5" />}
            iconBg="rgba(88, 101, 242, 0.12)"
            iconColor="#5865F2"
            title={t('discordTitle')}
            description={t('discordDesc')}
            ctaText={t('discordCta')}
            onSelect={onClose}
          />
        </div>

        <div
          className="px-6 pb-5 pt-1 text-[11px]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('hint')}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ChannelCardProps {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  ctaText: string;
  onSelect: () => void;
}

function ChannelCard({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  description,
  ctaText,
  onSelect,
}: ChannelCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onSelect}
      className="group rounded-xl border p-4 flex flex-col gap-3 transition-all hover:shadow-md"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      <span
        className="inline-flex items-center gap-1 text-xs font-medium pt-1"
        style={{ color: iconColor }}
      >
        {ctaText}
        <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}
