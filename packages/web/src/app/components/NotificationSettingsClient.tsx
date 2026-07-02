'use client';

/**
 * Notification settings (ADR 0024 Stage I).
 *
 * Per-user toggles for email + Web Push channels, plus the digest
 * cadence picker. The push toggle does double duty: checking it
 * asks the browser for permission and POSTs the subscription to
 * the backend; unchecking it unsubscribes locally (the backend
 * row stays until the user revokes it explicitly via the device
 * list below).
 *
 * Mounts in two modes:
 *   - page  (no onClose) — legacy /settings/notifications route
 *   - modal (with onClose) — Notion/Linear-style centered overlay
 *     triggered from the workspace switcher menu.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Loader2, Mail, Trash2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  type NotificationPreference,
  type DigestFrequency,
  type BackendWebPushSubscription,
  getNotificationPreference,
  updateNotificationPreference,
  listWebPushSubscriptions,
  deleteWebPushSubscription,
} from '@/lib/backend';
import {
  enableWebPush,
  disableWebPush,
  isWebPushSupported,
} from '@/lib/notification/webpush';

const DIGEST_KEYS: Array<{ value: DigestFrequency; key: string }> = [
  { value: 'instant', key: 'digestInstant' },
  { value: 'daily', key: 'digestDaily' },
  { value: 'weekly', key: 'digestWeekly' },
  { value: 'off', key: 'digestOff' },
];

interface NotificationSettingsClientProps {
  onClose?: () => void;
  /**
   * When true, skip the shell entirely (no portal, no overlay, no
   * page <main>, no header X) and render only the body content —
   * used by SettingsHub which provides its own frame + close button.
   */
  embedded?: boolean;
}

export default function NotificationSettingsClient({
  onClose,
  embedded = false,
}: NotificationSettingsClientProps = {}) {
  const t = useTranslations('notificationSettings');
  const isModal = Boolean(onClose);
  const [pref, setPref] = useState<NotificationPreference | null>(null);
  const [subs, setSubs] = useState<BackendWebPushSubscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getNotificationPreference(), listWebPushSubscriptions()])
      .then(([p, s]) => {
        if (cancelled) return;
        setPref(p);
        setSubs(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const update = async (patch: Partial<NotificationPreference>) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateNotificationPreference(patch);
      setPref(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (next: boolean) => {
    if (next) {
      try {
        const ok = await enableWebPush();
        if (!ok) {
          toast.error(t('permissionRequired'));
          return;
        }
        const fresh = await listWebPushSubscriptions();
        setSubs(fresh);
        await update({ pushOnMention: true });
        toast.success(t('pushEnabled'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('subscribeFailed'));
      }
    } else {
      try {
        await disableWebPush();
        await update({ pushOnMention: false });
        toast.success(t('pushDisabled'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('unsubscribeFailed'));
      }
    }
  };

  const removeSubscription = async (sub: BackendWebPushSubscription) => {
    if (!window.confirm(t('confirmDeleteDevice'))) return;
    try {
      await deleteWebPushSubscription(sub.id);
      setSubs((prev) => prev?.filter((s) => s.id !== sub.id) ?? prev);
      toast.success(t('deviceDeleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('deleteDeviceFailed'));
    }
  };

  if (error) {
    return wrapShell(
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </p>,
      { isModal, onClose, embedded },
    );
  }

  if (!pref || !subs) {
    return wrapShell(
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>,
      { isModal, onClose, embedded },
    );
  }

  const supported = isWebPushSupported();

  return wrapShell(
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('subtitle')}
        </p>
      </header>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <Mail className="h-4 w-4" /> {t('emailSection')}
        </h2>
        <Toggle
          label={t('emailMention')}
          checked={pref.emailOnMention}
          onChange={(v) => update({ emailOnMention: v })}
        />
        <Toggle
          label={t('emailReply')}
          checked={pref.emailOnCommentReply}
          onChange={(v) => update({ emailOnCommentReply: v })}
        />
        <div className="mt-4">
          <label className="mb-2 block text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('frequency')}
          </label>
          <select
            value={pref.digestFrequency}
            onChange={(e) => update({ digestFrequency: e.target.value as DigestFrequency })}
            className="w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-primary)', background: 'transparent', color: 'var(--text-primary)' }}
          >
            {DIGEST_KEYS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </select>
        </div>
      </section>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <Bell className="h-4 w-4" /> {t('pushSection')}
        </h2>
        {!supported && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('pushUnsupported')}
          </p>
        )}
        {supported && (
          <>
            <Toggle
              label={t('pushMention')}
              checked={pref.pushOnMention}
              onChange={togglePush}
            />
            <Toggle
              label={t('pushReply')}
              checked={pref.pushOnCommentReply}
              onChange={(v) => update({ pushOnCommentReply: v })}
            />

            {subs.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('subscribedDevices', { count: subs.length })}
                </p>
                <ul className="space-y-1.5">
                  {subs.map((sub) => (
                    <li
                      key={sub.id}
                      className="flex items-center gap-2 rounded border px-3 py-1.5 text-xs"
                      style={{ borderColor: 'var(--border-primary)' }}
                    >
                      <ShieldCheck className="h-3 w-3" style={{ color: 'var(--text-secondary)' }} />
                      <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {(sub.userAgent ?? sub.endpoint).slice(0, 80)}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubscription(sub)}
                        className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title={t('deleteDevice')}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>,
    { isModal, onClose, embedded },
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 text-sm cursor-pointer">
      <span style={{ color: 'var(--text-primary)' }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

function wrapShell(
  body: ReactNode,
  { isModal, onClose, embedded }: { isModal: boolean; onClose?: () => void; embedded?: boolean },
): ReactNode {
  // Embedded (SettingsHub pane) — the hub owns the frame; render bare body.
  if (embedded) return body;
  if (!isModal) {
    return <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">{body}</main>;
  }
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)]"
            aria-label="close"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{body}</div>
      </div>
    </div>,
    document.body,
  );
}
