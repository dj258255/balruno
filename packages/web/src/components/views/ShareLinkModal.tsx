'use client';

/**
 * ShareLinkModal — list and mint share links for a (project, sheet)
 * tuple (ADR 0027).
 *
 * The modal shows:
 *   - existing active links (token + creation time + last used)
 *   - revoke button per link
 *   - create-link form (sheet pin + activeView pin + expiry preset)
 *
 * The token is *always* truncated in the UI; the full URL is only
 * exposed on click of the copy button. Revoke is one-click — there's
 * no rename / undo. Once a link is out, the only safe operation is
 * "stop the bleeding."
 */

import { useEffect, useState } from 'react';
import { Copy, X, Trash2, Check, Loader2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  type ShareLink,
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from '@/lib/backend';
import type { Sheet } from '@/types';

interface ShareLinkModalProps {
  projectId: string;
  sheet: Sheet;
  onClose: () => void;
}

export function ShareLinkModal({ projectId, sheet, onClose }: ShareLinkModalProps) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state for the new-link row.
  const [pinSheet, setPinSheet] = useState(true);
  const [pinView, setPinView] = useState(true);
  const [expiryDays, setExpiryDays] = useState<number | 'never'>(30);

  useEffect(() => {
    let cancelled = false;
    listShareLinks(projectId)
      .then((rows) => {
        if (!cancelled) setLinks(rows.filter((l) => !l.revokedAt));
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
    setCreating(true);
    try {
      const expiresAt =
        expiryDays === 'never'
          ? null
          : new Date(Date.now() + expiryDays * 86400_000).toISOString();
      const link = await createShareLink(projectId, {
        sheetId: pinSheet ? sheet.id : null,
        activeView: pinView ? (sheet.activeView ?? 'grid') : null,
        expiresAt,
      });
      setLinks((prev) => (prev ? [link, ...prev] : [link]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '링크 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (link: ShareLink) => {
    if (!window.confirm('이 링크를 취소할까요? 현재 보고 있는 사람도 즉시 차단됩니다.')) {
      return;
    }
    try {
      await revokeShareLink(link.id);
      setLinks((prev) => prev?.filter((l) => l.id !== link.id) ?? prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '취소 실패');
    }
  };

  const fullUrl = (token: string) =>
    `${window.location.origin}/share/${token}`;

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl(token));
      toast.success('링크 복사됨');
    } catch {
      toast.error('복사 실패 — 브라우저 권한 확인');
    }
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
            <Globe2 className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              공유 링크
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

        {/* Create form */}
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            토큰 보유자는 누구나 *읽기 전용* 으로 시트를 볼 수 있습니다. 편집은 불가.
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={pinSheet}
                onChange={(e) => setPinSheet(e.target.checked)}
              />
              현재 시트만
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={pinView}
                onChange={(e) => setPinView(e.target.checked)}
              />
              현재 뷰 고정 ({sheet.activeView ?? 'grid'})
            </label>
            <label className="flex items-center gap-1.5">
              만료
              <select
                value={String(expiryDays)}
                onChange={(e) => setExpiryDays(e.target.value === 'never' ? 'never' : Number(e.target.value))}
                className="rounded border bg-transparent px-2 py-1 text-xs"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="1">1일</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="never">없음</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="ml-auto rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {creating ? '생성 중...' : '링크 생성'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {links === null && !error && (
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
          {links && links.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              아직 공유 링크가 없습니다.
            </p>
          )}
          {links && links.length > 0 && (
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                      {fullUrl(link.token)}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {link.sheetId ? '시트 고정' : '프로젝트 전체'}
                      {' · '}
                      {link.activeView ? `${link.activeView} 뷰 고정` : '현재 뷰'}
                      {' · '}
                      {link.expiresAt
                        ? `${new Date(link.expiresAt).toLocaleDateString()} 만료`
                        : '만료 없음'}
                      {link.lastUsedAt && (
                        <>
                          {' · '}
                          마지막 접근 {new Date(link.lastUsedAt).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(link.token)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                    title="복사"
                  >
                    <Copy className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(link)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="취소"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer
          className="flex items-center justify-end border-t px-4 py-2 text-xs"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
        >
          <Check className="mr-1 h-3 w-3" />
          취소 시 즉시 차단 (캐시 없음)
        </footer>
      </div>
    </div>
  );
}
