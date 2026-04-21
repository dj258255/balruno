'use client';

/**
 * 문서 아이콘 (이모지) 피커 — emoji-mart 기반.
 *
 * 저작권: 이모지 문자 자체는 유니코드 표준으로 저작권 대상 아님.
 * OS 폰트 (Apple Color Emoji / Segoe UI Emoji / Noto) 로 렌더되므로
 * 이 앱에 특정 이모지 이미지 자산을 포함하지 않음. emoji-mart 는 MIT.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';

// emoji-mart 는 꽤 큰 번들이므로 dynamic — 피커 열 때만 로드
const Picker = dynamic(
  () => import('@emoji-mart/react').then((m) => m.default),
  { ssr: false, loading: () => <div className="w-80 h-96 rounded-lg border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }} /> }
);

interface Props {
  /** 현재 이모지 (없으면 FileText fallback) */
  icon?: string;
  onChange: (emoji: string | undefined) => void;
  /** 아이콘 표시 크기 — 트리거 버튼 안 */
  size?: 'sm' | 'md' | 'lg';
  /** 버튼 추가 className */
  className?: string;
  /** 버튼 스타일 (배경/테두리) */
  buttonStyle?: React.CSSProperties;
}

const SIZE_CLASS = {
  sm: 'w-4 h-4 text-[16px]',
  md: 'w-6 h-6 text-[20px]',
  lg: 'w-10 h-10 text-[32px]',
};

export default function DocIconPicker({ icon, onChange, size = 'md', className = '', buttonStyle }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const sizeCls = SIZE_CLASS[size];
  const fallbackIconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 28;

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors ${sizeCls}`}
        style={{ lineHeight: 1, ...buttonStyle }}
        title="아이콘 변경"
        aria-label="문서 아이콘 변경"
      >
        {icon ? (
          <span style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}>
            {icon}
          </span>
        ) : (
          <FileText size={fallbackIconSize} style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1" onMouseDown={(e) => e.stopPropagation()}>
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
        </div>
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
        이모지 로딩...
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
        locale="ko"
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
          아이콘 제거 (기본값으로 복원)
        </button>
      )}
    </div>
  );
}
