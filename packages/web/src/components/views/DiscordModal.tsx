'use client';

/**
 * DiscordModal — link a Discord bot to a Balruno workspace
 * (ADR 0030).
 *
 * The flow is *manual setup* in v1 (no OAuth2 install URL):
 *   1. user creates a Discord Application + Bot at
 *      https://discord.com/developers/applications
 *   2. copies App ID + Public Key + Bot Token + invites bot to
 *      their guild
 *   3. pastes the four strings here + picks a default sheet
 *   4. backend stores them, registers /balruno slash commands via
 *      the Discord REST API on first interaction
 *
 * v2 will replace this with a hosted OAuth flow, but that needs
 * a public Discord App we register + verify (which costs $0 but is
 * a separate ops dance).
 */

import { useEffect, useState } from 'react';
import { Loader2, X, Trash2, Plug, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  type DiscordLink,
  createDiscordLink,
  listDiscordLinks,
  deleteDiscordLink,
} from '@/lib/backend';
import type { Sheet } from '@/types';

interface Props {
  workspaceId: string;
  sheets: Sheet[];
  onClose: () => void;
}

export function DiscordModal({ workspaceId, sheets, onClose }: Props) {
  const [links, setLinks] = useState<DiscordLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [guildId, setGuildId] = useState('');
  const [appId, setAppId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [botToken, setBotToken] = useState('');
  const [defaultSheetId, setDefaultSheetId] = useState('');

  useEffect(() => {
    let cancelled = false;
    listDiscordLinks(workspaceId)
      .then((rows) => { if (!cancelled) setLinks(rows); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '로드 실패'); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleCreate = async () => {
    if (creating) return;
    if (!guildId || !appId || !publicKey || !botToken) {
      toast.error('모든 필드를 입력하세요');
      return;
    }
    setCreating(true);
    try {
      const link = await createDiscordLink(workspaceId, {
        discordGuildId: guildId,
        discordApplicationId: appId,
        discordPublicKey: publicKey,
        discordBotToken: botToken,
        defaultSheetId: defaultSheetId || null,
      });
      setLinks((prev) => (prev ? [link, ...prev] : [link]));
      toast.success('Discord 연결됨');
      setGuildId(''); setAppId(''); setPublicKey(''); setBotToken(''); setDefaultSheetId('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (link: DiscordLink) => {
    if (!window.confirm('이 Discord 연결을 삭제할까요?')) return;
    try {
      await deleteDiscordLink(link.id);
      setLinks((prev) => prev?.filter((l) => l.id !== link.id) ?? prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const interactionUrl = `${window.location.origin}/api/v1/discord/interactions`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-lg border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Discord 연동
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--bg-hover)]" aria-label="닫기">
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </header>

        <details className="border-b px-4 py-3 text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
          <summary className="cursor-pointer text-sm" style={{ color: 'var(--text-primary)' }}>
            Discord Bot 만드는 법 (5단계)
          </summary>
          <ol className="ml-4 mt-2 list-decimal space-y-1">
            <li>
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
                style={{ color: 'var(--accent)' }}
              >
                Discord Developer Portal
                <ExternalLink className="h-3 w-3" />
              </a>
              에서 New Application
            </li>
            <li>General Information 의 <code>Application ID</code> + <code>Public Key</code> 복사</li>
            <li>Bot 탭 → Reset Token, 받은 <code>Bot Token</code> 복사</li>
            <li>General Information 의 Interaction Endpoint URL 에 다음 입력 후 저장:
              <code className="ml-1 rounded bg-neutral-100 px-1 dark:bg-neutral-800">{interactionUrl}</code>
            </li>
            <li>OAuth2 → URL Generator 에서 <code>bot</code> + <code>applications.commands</code> scope 선택, 생성된 URL 로 본인 서버에 봇 초대 후 서버 ID (Guild ID) 복사</li>
          </ol>
        </details>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Input label="Guild ID" value={guildId} onChange={setGuildId} placeholder="123456789012345678" />
            <Input label="Application ID" value={appId} onChange={setAppId} placeholder="987654321098765432" />
            <Input label="Public Key" value={publicKey} onChange={setPublicKey} placeholder="abcdef..." mono />
            <Input label="Bot Token" value={botToken} onChange={setBotToken} placeholder="MTI...." mono type="password" />
            <label className="col-span-2 flex flex-col gap-1">
              <span>기본 sheet (/balruno bug 행이 들어갈 시트)</span>
              <select
                value={defaultSheetId}
                onChange={(e) => setDefaultSheetId(e.target.value)}
                className="rounded border bg-transparent px-3 py-2"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">(없음)</option>
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {creating ? '연결 중...' : '연결'}
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
          {links === null && !error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />로딩 중...
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          {links && links.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>연결된 Discord 가 없습니다.</p>
          )}
          {links && links.length > 0 && (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-primary)' }}>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium dark:bg-neutral-800" style={{ color: 'var(--text-primary)' }}>guild</span>
                  <code className="font-mono" style={{ color: 'var(--text-secondary)' }}>{link.discordGuildId}</code>
                  <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {link.lastInteractionAt
                      ? `마지막: ${new Date(link.lastInteractionAt).toLocaleString()}`
                      : '아직 사용 안 함'}
                  </span>
                  <button type="button" onClick={() => handleDelete(link)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-950/30" title="삭제">
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, mono, type }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`rounded border bg-transparent px-3 py-2 ${mono ? 'font-mono' : ''}`}
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
      />
    </label>
  );
}
