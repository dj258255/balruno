'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch, Locale } from '@/lib/i18n';
import { useEscapeKey } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { Check, Globe, Cloud, Monitor, Webhook, Copy, Send } from 'lucide-react';
import { WEBHOOK_PRESETS, renderWebhookBody } from '@/lib/webhookPresets';
import { toast } from '@/components/ui/Toast';

type SettingsTab = 'language' | 'sync' | 'integrations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PresetCard({ preset }: { preset: typeof WEBHOOK_PRESETS[number] }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const sampleValues = Object.fromEntries(
    preset.variables.map((v) => [v.key, v.example])
  );
  const renderedBody = renderWebhookBody(preset.bodyTemplate, sampleValues);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preset.bodyTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사 실패');
    }
  };

  const handleTest = async () => {
    if (!url.trim() || !url.startsWith('http')) {
      toast.error('유효한 URL 을 입력하세요');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(url, {
        method: preset.method,
        headers: { 'Content-Type': 'application/json' },
        body: renderedBody,
      });
      if (res.ok) {
        toast.success(`Test 성공 (${res.status})`);
      } else {
        toast.error(`Test 실패: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      toast.error(`Test 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="p-2.5 rounded-lg space-y-2"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {preset.name}
        </div>
        <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          {preset.description}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={preset.urlHint}
          className="flex-1 px-2 py-1 text-caption rounded font-mono"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={handleCopy}
          className="p-1.5 rounded"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          title="body 복사"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !url.trim()}
          className="p-1.5 rounded"
          style={{
            background: testing ? 'var(--bg-secondary)' : 'var(--accent)',
            color: testing ? 'var(--text-tertiary)' : 'white',
          }}
          title="샘플 payload 로 테스트 발송"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
      <details>
        <summary
          className="text-caption cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          Body 미리보기 (샘플 값 치환됨) — {preset.variables.length}개 변수
        </summary>
        <pre
          className="mt-1 p-1.5 rounded text-caption overflow-x-auto font-mono"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {renderedBody}
        </pre>
      </details>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const t = useTranslations();
  const { locale, setLocale } = useLocaleSwitch();
  const [activeTab, setActiveTab] = useState<SettingsTab>('language');

  // Auth store
  const { serverUrl, setServerUrl, isAuthenticated, user, logout } = useAuthStore();
  const [inputServerUrl, setInputServerUrl] = useState(serverUrl ?? '');

  // ESC 키로 닫기
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleLanguageChange = (lang: Locale) => {
    setLocale(lang);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSaveServerUrl = () => {
    const url = inputServerUrl.trim();
    setServerUrl(url || null);
  };

  const languages: { code: Locale; name: string; nativeName: string }[] = [
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'en', name: 'English', nativeName: 'English' },
  ];

  const tabs = [
    { id: 'language' as const, icon: Globe, label: t('settings.language') },
    { id: 'sync' as const, icon: Cloud, label: t('settings.sync') },
    { id: 'integrations' as const, icon: Webhook, label: 'Integrations' },
  ];

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-500/20 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 px-4 pt-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: activeTab === tab.id ? 'var(--bg-tertiary)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="py-4">
          {activeTab === 'language' && (
            <div>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{
                    backgroundColor: locale === lang.code ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span
                      className="text-sm font-medium"
                      style={{ color: locale === lang.code ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {lang.nativeName}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {lang.name}
                    </span>
                  </div>
                  {locale === lang.code && (
                    <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="px-5 space-y-4">
              {/* 현재 모드 표시 */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <Monitor className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('settings.currentMode')}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {serverUrl ? t('settings.cloudMode') : t('settings.localMode')}
                  </div>
                </div>
              </div>

              {/* 서버 URL 설정 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('settings.serverUrl')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputServerUrl}
                    onChange={(e) => setInputServerUrl(e.target.value)}
                    placeholder="https://api.example.com"
                    className="flex-1 px-3 py-2 text-sm rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={handleSaveServerUrl}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                    }}
                  >
                    {t('common.save')}
                  </button>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('settings.serverUrlHint')}
                </p>
              </div>

              {/* 로그인 상태 */}
              {serverUrl && (
                <div
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {isAuthenticated && user ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {user.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={logout}
                        className="px-3 py-1 text-xs font-medium rounded-lg transition-colors hover:bg-red-500/20"
                        style={{ color: 'var(--error)' }}
                      >
                        {t('settings.logout')}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {t('settings.notLoggedIn')}
                      </p>
                      <button
                        onClick={() => {
                          // TODO: 로그인 모달 열기
                          console.log('Open login modal');
                        }}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                        }}
                      >
                        {t('settings.login')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 로컬 모드 안내 */}
              {!serverUrl && (
                <div
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--accent-light)',
                    border: '1px solid var(--accent)',
                  }}
                >
                  <p className="text-sm" style={{ color: 'var(--accent)' }}>
                    {t('settings.localModeDescription')}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="px-5 space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Track 14 — 외부 툴과 양방향 통합. 복사 버튼으로 body 템플릿을 클립보드에 담고,
                Test 버튼으로 직접 웹훅 URL 에 샘플 payload 를 발송할 수 있습니다.
              </p>
              {(['discord', 'slack', 'github', 'notion', 'generic'] as const).map((service) => {
                const presets = WEBHOOK_PRESETS.filter((p) => p.service === service);
                if (presets.length === 0) return null;
                return (
                  <div key={service}>
                    <h3
                      className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {service}
                    </h3>
                    <div className="space-y-1.5">
                      {presets.map((p) => (
                        <PresetCard key={p.id} preset={p} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div
                className="p-2.5 rounded-lg text-caption"
                style={{
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                }}
              >
                사용법: Automation 패널 → Webhook 액션 → URL 붙여넣기 + 위 프리셋의 body 템플릿 복사.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
