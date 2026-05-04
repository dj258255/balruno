/**
 * 모바일 환경에서 기능 제약을 알리는 배너.
 * localStorage 로 닫기 상태 유지 (1주일).
 */

import { useEffect, useState } from 'react';
import { Monitor, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

const KEY = 'balruno:mobile-notice-dismissed';
const TTL = 7 * 24 * 60 * 60 * 1000; // 1주

export default function MobileNotice() {
  const t = useTranslations('mobileNotice');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      setShow(true);
      return;
    }
    const ts = parseInt(raw, 10);
    if (!isNaN(ts) && Date.now() - ts < TTL) {
      setShow(false);
    } else {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="md:hidden fixed top-14 left-0 right-0 z-40 px-3 py-2 flex items-start gap-2 border-b"
      style={{
        background: 'linear-gradient(90deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
        borderColor: 'var(--border-primary)',
      }}
      role="status"
      aria-label={t('ariaLabel')}
    >
      <Monitor size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1 text-caption" style={{ color: 'var(--text-primary)' }}>
        <strong>{t('title')}</strong>{t('body')}
      </div>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-[var(--bg-tertiary)] flex-shrink-0"
        aria-label={t('dismiss')}
      >
        <X size={12} style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  );
}
