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

const DIGEST_OPTIONS: Array<{ value: DigestFrequency; label: string }> = [
  { value: 'instant', label: '즉시 (이벤트마다 1통)' },
  { value: 'daily', label: '하루 1통 요약' },
  { value: 'weekly', label: '주 1통 요약' },
  { value: 'off', label: '이메일 끔' },
];

interface NotificationSettingsClientProps {
  onClose?: () => void;
}

export default function NotificationSettingsClient({ onClose }: NotificationSettingsClientProps = {}) {
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
        if (!cancelled) setError(e instanceof Error ? e.message : '로드 실패');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = async (patch: Partial<NotificationPreference>) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateNotificationPreference(patch);
      setPref(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (next: boolean) => {
    if (next) {
      try {
        const ok = await enableWebPush();
        if (!ok) {
          toast.error('브라우저 알림 권한이 필요합니다');
          return;
        }
        const fresh = await listWebPushSubscriptions();
        setSubs(fresh);
        await update({ pushOnMention: true });
        toast.success('이 기기에서 푸시 알림을 받습니다');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '구독 실패');
      }
    } else {
      try {
        await disableWebPush();
        await update({ pushOnMention: false });
        toast.success('이 기기 구독 해제');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '해제 실패');
      }
    }
  };

  const removeSubscription = async (sub: BackendWebPushSubscription) => {
    if (!window.confirm('이 기기의 푸시 구독을 삭제할까요?')) return;
    try {
      await deleteWebPushSubscription(sub.id);
      setSubs((prev) => prev?.filter((s) => s.id !== sub.id) ?? prev);
      toast.success('삭제됨');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  if (error) {
    return wrapShell(
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </p>,
      { isModal, onClose },
    );
  }

  if (!pref || !subs) {
    return wrapShell(
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>,
      { isModal, onClose },
    );
  }

  const supported = isWebPushSupported();

  return wrapShell(
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          알림 설정
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          @멘션 / 답글에 대한 알림 채널을 선택합니다. 이메일은 자체호스트 시 SMTP 설정이 필요하며, Web Push 는 브라우저 표준 (VAPID) 으로 영구 무료입니다.
        </p>
      </header>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <Mail className="h-4 w-4" /> 이메일
        </h2>
        <Toggle
          label="@멘션을 받았을 때"
          checked={pref.emailOnMention}
          onChange={(v) => update({ emailOnMention: v })}
        />
        <Toggle
          label="내 코멘트에 답글이 달렸을 때"
          checked={pref.emailOnCommentReply}
          onChange={(v) => update({ emailOnCommentReply: v })}
        />
        <div className="mt-4">
          <label className="mb-2 block text-xs" style={{ color: 'var(--text-tertiary)' }}>
            발송 빈도
          </label>
          <select
            value={pref.digestFrequency}
            onChange={(e) => update({ digestFrequency: e.target.value as DigestFrequency })}
            className="w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-primary)', background: 'transparent', color: 'var(--text-primary)' }}
          >
            {DIGEST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <Bell className="h-4 w-4" /> 브라우저 푸시
        </h2>
        {!supported && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            이 브라우저는 Web Push 를 지원하지 않습니다.
          </p>
        )}
        {supported && (
          <>
            <Toggle
              label="@멘션을 받았을 때 (이 기기)"
              checked={pref.pushOnMention}
              onChange={togglePush}
            />
            <Toggle
              label="내 코멘트에 답글이 달렸을 때 (이 기기)"
              checked={pref.pushOnCommentReply}
              onChange={(v) => update({ pushOnCommentReply: v })}
            />

            {subs.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  구독 중인 기기 ({subs.length})
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
                        title="삭제"
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
    { isModal, onClose },
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
  { isModal, onClose }: { isModal: boolean; onClose?: () => void },
): ReactNode {
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
