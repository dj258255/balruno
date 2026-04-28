'use client';

/**
 * MobileContextMenu - 모바일 컨텍스트 메뉴 (액션 시트)
 *
 * 모바일에서 롱프레스 시 하단에서 슬라이드업 되는 메뉴
 *
 * 참고:
 * - iOS Action Sheet 패턴
 * - Google Sheets 모바일 컨텍스트 메뉴
 * - Material Design Bottom Sheet
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export interface MobileContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface MobileContextMenuProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: MobileContextMenuItem[];
}

export function MobileContextMenu({
  open,
  onClose,
  title,
  items,
}: MobileContextMenuProps) {
  const t = useTranslations('ui');
  const menuRef = useRef<HTMLDivElement>(null);

  // 배경 클릭 시 닫기
  useEffect(() => {
    if (!open) return;

    const handleBackdropClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 약간의 딜레이 후 이벤트 등록 (열리는 애니메이션 중 닫히는 것 방지)
    const timer = setTimeout(() => {
      document.addEventListener('click', handleBackdropClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleBackdropClick);
    };
  }, [open, onClose]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        style={{ opacity: open ? 1 : 0 }}
      />

      {/* 메뉴 */}
      <div
        ref={menuRef}
        className="mobile-context-menu open"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
        }}
      >
        {/* 드래그 핸들 */}
        <div className="mobile-context-menu-handle" />

        {/* 타이틀 (있으면) */}
        {title && (
          <div
            className="px-5 pb-3 mb-2 border-b"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <span
              className="font-semibold text-base"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </span>
          </div>
        )}

        {/* 메뉴 아이템 */}
        <div className="px-2">
          {items.map((item) => (
            <button
              key={item.id}
              className={`mobile-context-menu-item w-full text-left ${
                item.destructive ? 'destructive' : ''
              }`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              style={{
                opacity: item.disabled ? 0.5 : 1,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {item.icon && (
                <span className="w-5 h-5 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* 취소 버튼 */}
        <div className="px-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            className="mobile-context-menu-item w-full text-center justify-center font-medium"
            onClick={onClose}
            style={{ color: 'var(--accent)' }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MobileContextMenu;
