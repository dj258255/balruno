'use client';

interface Props {
  onClose: () => void;
}

export default function ChangeHistoryPanel({ onClose }: Props) {
  return (
    <div className="flex flex-col h-full p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>변경 이력</h2>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm rounded-md hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          닫기
        </button>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        변경 이력 기능은 준비 중입니다.
      </p>
    </div>
  );
}
