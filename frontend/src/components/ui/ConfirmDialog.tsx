'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useEscapeKey } from '@/hooks';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'danger',
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'var(--error-light)',
      iconColor: 'var(--error)',
      buttonBg: 'var(--error)',
      buttonHover: '#dc2626',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'var(--warning-light)',
      iconColor: 'var(--warning)',
      buttonBg: 'var(--warning)',
      buttonHover: '#d97706',
    },
    info: {
      icon: AlertTriangle,
      iconBg: 'var(--primary-blue-light)',
      iconColor: 'var(--primary-blue)',
      buttonBg: 'var(--primary-blue)',
      buttonHover: '#2563eb',
    },
  };

  const style = variantStyles[variant];
  const IconComponent = style.icon;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center modal-overlay"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl shadow-2xl animate-scaleIn overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: style.iconBg }}
            >
              <IconComponent className="w-5 h-5" style={{ color: style.iconColor }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="대화상자 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>

        {/* 버튼 영역 */}
        <div
          className="flex gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: style.buttonBg,
              color: 'white',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = style.buttonHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = style.buttonBg)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
