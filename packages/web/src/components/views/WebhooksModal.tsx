'use client';

/**
 * WebhooksModal — manage outbound webhooks for a project (ADR 0028).
 *
 * Mirrors ShareLinkModal's UX shape — list existing subscriptions,
 * mint a new one, copy the secret on creation. Once the secret is
 * dismissed it cannot be retrieved (the list endpoint nulls it
 * out); the user must regenerate by deleting + recreating.
 */

import { useEffect, useState } from 'react';
import { Loader2, Plug, X, Trash2, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  type BackendWebhook,
  type WebhookEvent,
  KNOWN_WEBHOOK_EVENTS,
  createWebhook,
  listWebhooks,
  toggleWebhook,
  deleteWebhook,
} from '@/lib/backend';

interface WebhooksModalProps {
  projectId: string;
  onClose: () => void;
}

export function WebhooksModal({ projectId, onClose }: WebhooksModalProps) {
  const [hooks, setHooks] = useState<BackendWebhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEvent>>(
    new Set(['comment.added', 'mention.created']),
  );
  const [justCreatedSecret, setJustCreatedSecret] = useState<{ id: string; secret: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWebhooks(projectId)
      .then((rows) => {
        if (!cancelled) setHooks(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '로드 실패');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCreate = async () => {
    if (creating) return;
    if (!url.trim().startsWith('https://')) {
      toast.error('URL은 https:// 로 시작해야 합니다');
      return;
    }
    if (selectedEvents.size === 0) {
      toast.error('최소 1개 이벤트를 선택하세요');
      return;
    }
    setCreating(true);
    try {
      const hook = await createWebhook(projectId, {
        url: url.trim(),
        events: Array.from(selectedEvents),
      });
      setHooks((prev) => (prev ? [hook, ...prev] : [hook]));
      if (hook.secret) {
        setJustCreatedSecret({ id: hook.id, secret: hook.secret });
      }
      setUrl('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (hook: BackendWebhook) => {
    const next = !hook.active;
    try {
      await toggleWebhook(hook.id, next);
      setHooks((prev) =>
        prev?.map((h) => (h.id !== hook.id ? h : { ...h, active: next })) ?? prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상태 변경 실패');
    }
  };

  const handleDelete = async (hook: BackendWebhook) => {
    if (!window.confirm('이 웹훅을 삭제할까요?')) return;
    try {
      await deleteWebhook(hook.id);
      setHooks((prev) => prev?.filter((h) => h.id !== hook.id) ?? prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const handleCopySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('시크릿 복사됨');
    } catch {
      toast.error('복사 실패');
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              웹훅 (Outbound)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-[var(--bg-hover)]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </header>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            구독한 이벤트가 발생할 때마다 지정한 URL로 POST 요청을 보냅니다. HMAC-SHA256 서명은 X-Balruno-Signature 헤더에 담깁니다.
          </div>
          <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 outline-none"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
            <div className="flex flex-wrap items-center gap-2">
              {KNOWN_WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  <code className="font-mono">{ev}</code>
                </label>
              ))}
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !url.trim() || selectedEvents.size === 0}
                className="ml-auto rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {creating ? '생성 중...' : '구독 추가'}
              </button>
            </div>
          </div>
        </div>

        {justCreatedSecret && (
          <div
            className="border-b bg-yellow-50 px-4 py-3 text-xs dark:bg-yellow-900/20"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <div className="mb-1 font-medium">시크릿이 생성되었습니다 (한 번만 표시)</div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <code className="flex-1 truncate">{justCreatedSecret.secret}</code>
              <button
                type="button"
                onClick={() => handleCopySecret(justCreatedSecret.secret)}
                className="inline-flex h-7 items-center gap-1 rounded border px-2"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <Copy className="h-3 w-3" /> 복사
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedSecret(null)}
                className="inline-flex h-7 items-center gap-1 rounded px-2 hover:bg-[var(--bg-hover)]"
              >
                확인
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {hooks === null && !error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              로딩 중...
            </div>
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
          {hooks && hooks.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              아직 등록된 웹훅이 없습니다.
            </p>
          )}
          {hooks && hooks.length > 0 && (
            <ul className="space-y-2">
              {hooks.map((hook) => (
                <li
                  key={hook.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                  style={{
                    borderColor: 'var(--border-primary)',
                    opacity: hook.active ? 1 : 0.6,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                      {hook.url}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {hook.events.join(' · ')}
                      {hook.lastAttemptAt && (
                        <>
                          {' · '}
                          마지막 {new Date(hook.lastAttemptAt).toLocaleString()}
                          {' '}
                          (
                          <span style={{ color: hook.lastStatusCode && hook.lastStatusCode >= 200 && hook.lastStatusCode < 300 ? '#16a34a' : '#dc2626' }}>
                            {hook.lastStatusCode ?? 'error'}
                          </span>
                          )
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(hook)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                    title={hook.active ? '비활성화' : '활성화'}
                  >
                    {hook.active ? (
                      <ToggleRight className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    ) : (
                      <ToggleLeft className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(hook)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer
          className="flex items-center gap-1 border-t px-4 py-2 text-xs"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
        >
          <Check className="h-3 w-3" />
          서명 검증 가이드:
          <code className="font-mono">HMAC-SHA256(body, secret)</code>
          를 X-Balruno-Signature 와 비교
        </footer>
      </div>
    </div>
  );
}
