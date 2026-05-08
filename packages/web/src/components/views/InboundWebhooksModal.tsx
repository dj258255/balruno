'use client';

/**
 * InboundWebhooksModal — manage *receivers* (ADR 0029).
 *
 * Outbound (already shipped) = Balruno emits events to your URL.
 * Inbound (this) = your external system POSTs to a Balruno URL,
 * we turn that into a row in the target sheet.
 *
 * Two providers ship in v1:
 *   github  — paste the URL + secret into your repo's webhook settings
 *   generic — sign your own JSON body with HMAC-SHA256, POST it
 *
 * The modal mirrors ShareLinkModal / WebhooksModal in shape: list +
 * create + delete + show "how to wire your external system".
 */

import { useEffect, useState } from 'react';
import { Loader2, X, Trash2, Copy, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import {
  type InboundWebhook,
  type InboundProvider,
  createInboundWebhook,
  listInboundWebhooks,
  deleteInboundWebhook,
} from '@/lib/backend';
import type { Sheet } from '@/types';

interface Props {
  projectId: string;
  sheet: Sheet;
  onClose: () => void;
}

export function InboundWebhooksModal({ projectId, sheet, onClose }: Props) {
  const [hooks, setHooks] = useState<InboundWebhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<InboundProvider>('github');
  // Column mapping pickers — three roles for GitHub
  const [titleColumn, setTitleColumn] = useState('');
  const [urlColumn, setUrlColumn] = useState('');
  const [statusColumn, setStatusColumn] = useState('');

  useEffect(() => {
    let cancelled = false;
    listInboundWebhooks(projectId)
      .then((rows) => { if (!cancelled) setHooks(rows); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '로드 실패'); });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const columnMapping: Record<string, string> = {};
      if (provider === 'github') {
        if (titleColumn) columnMapping.title = titleColumn;
        if (urlColumn) columnMapping.url = urlColumn;
        if (statusColumn) columnMapping.status = statusColumn;
      }
      const hook = await createInboundWebhook(projectId, {
        provider,
        targetSheetId: sheet.id,
        columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : null,
      });
      setHooks((prev) => (prev ? [hook, ...prev] : [hook]));
      toast.success('Inbound 웹훅 생성됨');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (hook: InboundWebhook) => {
    if (!window.confirm('이 inbound 를 삭제할까요?')) return;
    try {
      await deleteInboundWebhook(hook.id);
      setHooks((prev) => prev?.filter((h) => h.id !== hook.id) ?? prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const inboundUrl = (hook: InboundWebhook) =>
    `${window.location.origin}/api/v1/inbound-public/${hook.id}/${hook.provider}`;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} 복사됨`);
    } catch {
      toast.error('복사 실패');
    }
  };

  const selectColumns = sheet.columns.filter((c) => c.type === 'select' || c.type === 'multiSelect');
  const textColumns = sheet.columns.filter((c) => c.type === 'general');
  const urlColumns = sheet.columns.filter((c) => c.type === 'url');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              받기 — Inbound webhooks
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--bg-hover)]" aria-label="닫기">
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </header>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            외부 시스템이 POST 한 데이터를 *{sheet.name}* 시트의 새 row 로 자동 추가합니다.
          </div>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <label className="flex items-center gap-2">
              <span>Provider</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as InboundProvider)}
                className="rounded border bg-transparent px-2 py-1"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="github">GitHub (PR / Issue)</option>
                <option value="generic">Generic (custom HMAC)</option>
              </select>
            </label>
            {provider === 'github' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <ColumnPicker
                  label="Title 컬럼"
                  value={titleColumn}
                  onChange={setTitleColumn}
                  columns={textColumns}
                />
                <ColumnPicker
                  label="URL 컬럼"
                  value={urlColumn}
                  onChange={setUrlColumn}
                  columns={urlColumns}
                />
                <ColumnPicker
                  label="Status 컬럼"
                  value={statusColumn}
                  onChange={setStatusColumn}
                  columns={selectColumns}
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {creating ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {hooks === null && !error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />로딩 중...
            </div>
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>
          )}
          {hooks && hooks.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              아직 inbound 가 없습니다.
            </p>
          )}
          {hooks && hooks.length > 0 && (
            <ul className="space-y-3">
              {hooks.map((hook) => (
                <li key={hook.id} className="rounded-md border p-3" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium dark:bg-neutral-800" style={{ color: 'var(--text-primary)' }}>
                      {hook.provider}
                    </span>
                    {hook.lastReceivedAt && (
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        마지막: {new Date(hook.lastReceivedAt).toLocaleString()} ·
                        <span className="ml-1">{hook.lastStatus ?? 'pending'}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(hook)}
                      className="ml-auto rounded p-1 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Field label="URL" value={inboundUrl(hook)} onCopy={(v) => handleCopy(v, 'URL')} />
                    <Field label="Secret" value={hook.secret} onCopy={(v) => handleCopy(v, '시크릿')} mono />
                  </div>
                  {hook.provider === 'github' && (
                    <details className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <summary className="cursor-pointer">GitHub 연결 가이드</summary>
                      <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                        <li>GitHub 저장소 → Settings → Webhooks → Add webhook</li>
                        <li>Payload URL = 위 URL 복사</li>
                        <li>Content type = <code>application/json</code></li>
                        <li>Secret = 위 시크릿 복사</li>
                        <li>Events → "Pull requests" + "Issues"</li>
                      </ol>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: (v: string) => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 flex-shrink-0">{label}</span>
      <code className={`flex-1 truncate ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>{value}</code>
      <button type="button" onClick={() => onCopy(value)} className="rounded p-1 hover:bg-[var(--bg-hover)]" title="복사">
        <Copy className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
      </button>
    </div>
  );
}

function ColumnPicker({ label, value, onChange, columns }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  columns: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border bg-transparent px-2 py-1 text-xs"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      >
        <option value="">(자동)</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </label>
  );
}
