'use client';

/**
 * 전역 Toast 알림 시스템 — 에러/성공/정보 통합.
 *
 * 사용:
 *   import { toast } from '@/components/ui/Toast';
 *   toast.success('저장됨');
 *   toast.error('네트워크 오류');
 *   toast.info('자동화 실행 완료');
 *
 * 구현: 모듈 스코프 이벤트 에미터 + React 컨테이너.
 * 앱 루트에 <ToastContainer /> 한 번 마운트.
 */

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastLevel = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  level: ToastLevel;
  message: string;
  duration: number;
}

type Listener = (items: ToastItem[]) => void;

class ToastStore {
  items: ToastItem[] = [];
  listeners = new Set<Listener>();

  emit() {
    this.listeners.forEach((l) => l(this.items));
  }

  push(level: ToastLevel, message: string, duration = 3500) {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.items = [...this.items, { id, level, message, duration }];
    this.emit();
    setTimeout(() => this.remove(id), duration);
  }

  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const store = new ToastStore();

export const toast = {
  success: (msg: string, duration?: number) => store.push('success', msg, duration),
  error: (msg: string, duration?: number) => store.push('error', msg, duration ?? 5000),
  info: (msg: string, duration?: number) => store.push('info', msg, duration),
  warning: (msg: string, duration?: number) => store.push('warning', msg, duration ?? 4500),
};

const LEVEL_COLORS: Record<ToastLevel, { bg: string; border: string; text: string; icon: typeof CheckCircle }> = {
  success: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981', icon: CheckCircle },
  error: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444', icon: AlertTriangle },
  warning: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b', icon: AlertTriangle },
  info: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#3b82f6', icon: Info },
};

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = store.subscribe(setItems);
    return () => {
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      role="log"
      aria-live="polite"
    >
      {items.map((item) => {
        const theme = LEVEL_COLORS[item.level];
        const Icon = theme.icon;
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 px-3 py-2 rounded-lg shadow-lg border-2 min-w-[240px] max-w-md pointer-events-auto animate-toast-slide"
            style={{
              background: 'var(--bg-primary)',
              borderColor: theme.border,
            }}
          >
            <Icon size={14} style={{ color: theme.text, flexShrink: 0, marginTop: 2 }} />
            <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>
              {item.message}
            </span>
            <button
              onClick={() => store.remove(item.id)}
              className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
              aria-label="알림 닫기"
            >
              <X size={11} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes toast-slide {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        :global(.animate-toast-slide) {
          animation: toast-slide 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
