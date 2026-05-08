import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ProductIntro 모달 상태 — "왜 Balruno" 소개.
 *
 * 첫 진입 후 1 회 자동 표시 (persona 선택 후 짧은 딜레이). 이후 유저가 닫으면
 * seenAt 기록 → 자동으로 다시 안 뜸. WorkspaceSwitcher 드롭다운에서 "앱 소개"
 * 로 언제든 재접근.
 */
interface ProductIntroState {
  open: boolean;
  /** 마지막으로 본 시각 (null 이면 한 번도 안 봄) */
  seenAt: number | null;

  openIntro: () => void;
  closeIntro: () => void;
  markSeen: () => void;
  hasBeenSeen: () => boolean;
}

export const useProductIntro = create<ProductIntroState>()(
  persist(
    (set, get) => ({
      open: false,
      seenAt: null,

      openIntro: () => set({ open: true }),
      closeIntro: () => set({ open: false }),
      markSeen: () => set({ seenAt: Date.now(), open: false }),
      hasBeenSeen: () => get().seenAt !== null,
    }),
    {
      name: 'balruno:product-intro',
      // open 상태는 persist X (세션 시작 시 자동 open 하지 않게)
      partialize: (s) => ({ seenAt: s.seenAt }),
    },
  ),
);
