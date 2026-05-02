import { useEffect } from 'react';

/**
 * ESC 키를 눌렀을 때 콜백을 실행하는 훅
 * 모달, 패널 등을 닫을 때 사용
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, enabled]);
}
