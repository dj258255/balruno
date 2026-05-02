'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MemoEditModalProps {
  isOpen: boolean;
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

export default function MemoEditModal({
  isOpen,
  initialContent,
  onSave,
  onClose,
}: MemoEditModalProps) {
  const t = useTranslations();
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl animate-scaleIn"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {initialContent ? t('contextMenu.editMemo') : t('contextMenu.addMemo')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('memo.placeholder')}
            className="w-full h-32 px-3 py-2 text-sm rounded-lg resize-none focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              // @ts-ignore
              '--tw-ring-color': 'var(--primary-blue)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSave();
              }
            }}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Ctrl+Enter {t('common.save')}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: 'white',
              backgroundColor: 'var(--primary-blue)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-blue-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-blue)';
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
