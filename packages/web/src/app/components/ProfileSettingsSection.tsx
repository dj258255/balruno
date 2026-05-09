'use client';

/**
 * Profile settings — display name + avatar — embedded inside
 * AccountSettingsClient as the first section. Reads the current
 * user from useBackendAuthStore (server-canonical source of truth)
 * and writes via PATCH /api/v1/me.
 *
 * Avatar upload flow:
 *   1. User picks file (file input).
 *   2. uploadAvatar() POSTs multipart to backend, returns
 *      "/media/avatars/{userId}/{hash}.{ext}".
 *   3. PATCH /api/v1/me { avatarUrl } updates users.avatar_url.
 *   4. Local store mirrors the new user so the sidebar avatar
 *      refreshes without a roundtrip.
 *
 * "Remove" sends avatarUrl: '' which the backend interprets as
 * "clear back to OAuth default" — on next OAuth login the
 * provider's avatar is restored automatically.
 */

import { useRef, useState } from 'react';
import { Loader2, Pencil, Trash2, Upload, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { humanizeUploadError, resolveMediaUrl, updateProfile, uploadAvatar } from '@/lib/backend';
import { BackendError } from '@/lib/backend/client';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export default function ProfileSettingsSection() {
  const t = useTranslations();
  const user = useBackendAuthStore((s) => s.user);
  const setUser = useBackendAuthStore((s) => s.setUser);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  if (!user) {
    return (
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          로그인 정보를 불러오는 중...
        </p>
      </section>
    );
  }

  const nameDirty = name.trim().length > 0 && name.trim() !== (user.name ?? '');

  const handleNameSave = async () => {
    if (!nameDirty || savingName) return;
    setSavingName(true);
    try {
      const updated = await updateProfile({ name: name.trim() });
      setUser(updated);
      toast.success('이름이 저장되었습니다');
    } catch (e) {
      toast.error(humanError(e, '이름 저장 실패'));
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file later
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('이미지가 2MB 를 초과했습니다');
      return;
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      toast.error('PNG / JPEG / WebP / GIF 만 지원됩니다');
      return;
    }
    setUploadingAvatar(true);
    try {
      const { url } = await uploadAvatar(file);
      const updated = await updateProfile({ avatarUrl: url });
      setUser(updated);
      toast.success('프로필 사진이 변경되었습니다');
    } catch (err) {
      toast.error(humanizeUploadError(err, t, { kind: 'photo', maxLabel: '2MB' }));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (removingAvatar) return;
    setRemovingAvatar(true);
    try {
      const updated = await updateProfile({ avatarUrl: '' });
      setUser(updated);
      toast.success('기본 사진으로 되돌렸습니다');
    } catch (err) {
      toast.error(humanError(err, '사진 제거 실패'));
    } finally {
      setRemovingAvatar(false);
    }
  };

  const initials = (user.name ?? user.email)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.slice(0, 1).toUpperCase())
    .join('') || user.email.slice(0, 1).toUpperCase();

  return (
    <section
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
    >
      <h2 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        프로필
      </h2>

      <div className="flex items-start gap-4">
        {/* Avatar — 80x80 circle. Click to pick a file; hover shows
            the upload affordance overlay. */}
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveMediaUrl(user.avatarUrl) ?? ''}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: '1px solid var(--border-primary)' }}
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-lg font-semibold"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={uploadingAvatar || removingAvatar}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-colors disabled:opacity-50"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
            aria-label="프로필 사진 변경"
            title="프로필 사진 변경"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarFile}
            className="hidden"
          />
        </div>

        {/* Right column — name + avatar action row. */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: 'var(--text-tertiary)' }}
              htmlFor="profile-display-name"
            >
              표시 이름
            </label>
            <div className="flex items-center gap-2">
              <input
                id="profile-display-name"
                type="text"
                value={name}
                maxLength={120}
                onChange={(ev) => setName(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') void handleNameSave();
                }}
                placeholder={user.email}
                className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                style={{
                  borderColor: 'var(--border-primary)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={handleNameSave}
                disabled={!nameDirty || savingName}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                저장
              </button>
            </div>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              사이드바, 코멘트, 멘션 등 워크스페이스 전반에서 표시됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleAvatarPick}
              disabled={uploadingAvatar || removingAvatar}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              <Upload className="h-3 w-3" />
              사진 업로드
            </button>
            {user.avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar || removingAvatar}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {removingAvatar ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                사진 제거
              </button>
            )}
            <span style={{ color: 'var(--text-tertiary)' }}>
              PNG / JPEG / WebP / GIF · 2MB 이하
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function humanError(err: unknown, fallback: string): string {
  if (err instanceof BackendError) {
    if (err.code === 'INVALID_PROFILE') {
      return err.body?.detail ?? '프로필 입력이 올바르지 않습니다';
    }
    return err.body?.detail ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
