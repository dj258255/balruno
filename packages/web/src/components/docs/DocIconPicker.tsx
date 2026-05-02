'use client';

/**
 * 문서 아이콘 (이모지) 피커 — emoji-mart 기반.
 *
 * 저작권: 이모지 문자 자체는 유니코드 표준으로 저작권 대상 아님.
 * OS 폰트 (Apple Color Emoji / Segoe UI Emoji / Noto) 로 렌더되므로
 * 이 앱에 특정 이모지 이미지 자산을 포함하지 않음. emoji-mart 는 MIT.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { FileText, type LucideIcon } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

// emoji-mart 는 꽤 큰 번들이므로 dynamic — 피커 열 때만 로드
const Picker = dynamic(
  () => import('@emoji-mart/react').then((m) => m.default),
  { ssr: false, loading: () => <div className="w-80 h-96 rounded-lg border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }} /> }
);

interface Props {
  /** 현재 이모지 (없으면 fallbackIcon) */
  icon?: string;
  onChange: (emoji: string | undefined) => void;
  /** 아이콘 표시 크기 — 트리거 버튼 안 */
  size?: 'sm' | 'md' | 'lg';
  /** 버튼 추가 className */
  className?: string;
  /** 버튼 스타일 (배경/테두리) */
  buttonStyle?: React.CSSProperties;
  /** 이모지 미설정 시 보여줄 lucide 아이콘 (기본 FileText) */
  fallbackIcon?: LucideIcon;
  /** fallback 아이콘 색상 */
  fallbackColor?: string;
}

const SIZE_CLASS = {
  sm: 'w-4 h-4 text-[16px]',
  md: 'w-6 h-6 text-[20px]',
  lg: 'w-10 h-10 text-[32px]',
};

/** 범용 이모지 아이콘 피커 — 문서·시트 양쪽에서 사용 */
export default function DocIconPicker({
  icon,
  onChange,
  size = 'md',
  className = '',
  buttonStyle,
  fallbackIcon: FallbackIcon = FileText,
  fallbackColor = 'var(--text-secondary)',
}: Props) {
  const t = useTranslations('docs');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePos = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      // emoji-mart 기본 피커 크기 ~352×435 — 화면 오른쪽/아래로 벗어나면 반대쪽으로 뒤집기
      const PICKER_W = 352;
      const PICKER_H = 435;
      const margin = 4;
      let top = rect.bottom + margin;
      let left = rect.left;
      if (left + PICKER_W > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - PICKER_W - 8);
      }
      if (top + PICKER_H > window.innerHeight - 8) {
        // 아래 공간 부족 → 버튼 위로
        top = Math.max(8, rect.top - PICKER_H - margin);
      }
      setPos({ top, left });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const sizeCls = SIZE_CLASS[size];
  const fallbackIconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 28;

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      style={{ verticalAlign: 'middle' }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors ${sizeCls}`}
        style={{ lineHeight: 1, verticalAlign: 'middle', ...buttonStyle }}
        title={t('iconChange')}
        aria-label={t('iconChangeAria')}
      >
        {icon ? (
          <span
            className="leading-none"
            style={{
              fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {icon}
          </span>
        ) : (
          <FallbackIcon size={fallbackIconSize} style={{ color: fallbackColor, display: 'block' }} />
        )}
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[1200]"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <EmojiPickerInner
            onSelect={(e) => {
              onChange(e);
              setOpen(false);
            }}
            onRemove={
              icon
                ? () => {
                    onChange(undefined);
                    setOpen(false);
                  }
                : undefined
            }
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

/** 외부 async 모듈 (emoji-mart data + picker) 을 로드하는 래퍼 */
function EmojiPickerInner({
  onSelect,
  onRemove,
}: {
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('docs');
  const locale = useLocale();
  const [data, setData] = useState<unknown | null>(null);

  useEffect(() => {
    import('@emoji-mart/data').then((m) => setData(m.default));
  }, []);

  if (!data) {
    return (
      <div
        className="w-80 h-96 rounded-lg border flex items-center justify-center text-caption"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-tertiary)',
        }}
      >
        {t('emojiLoading')}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden shadow-xl border"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      <Picker
        data={data}
        onEmojiSelect={(e: { native: string }) => onSelect(e.native)}
        locale={locale === 'ko' ? 'ko' : 'en'}
        previewPosition="none"
        skinTonePosition="none"
        theme="auto"
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-full py-2 text-label hover:bg-[var(--bg-hover)] transition-colors border-t"
          style={{
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-primary)',
          }}
        >
          {t('removeIcon')}
        </button>
      )}
    </div>
  );
}
