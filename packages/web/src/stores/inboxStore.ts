import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Inbox 패널 전역 상태 + 읽음 관리.
 *
 * MVP 범위:
 *  - 패널 open/close
 *  - 읽음 id 집합 (localStorage persist) — changelog entry id 나 comment id 를 저장
 *
 * 데이터 수집 자체 (changelog / @mention) 는 InboxPanel 내부에서 live 조회 —
 * 스토어는 상태만 들고 간다.
 */
interface InboxState {
  open: boolean;
  /** 이미 읽은 항목 id 집합 */
  readIds: string[];

  openInbox: () => void;
  closeInbox: () => void;
  toggleInbox: () => void;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  isRead: (id: string) => boolean;
}

export const useInbox = create<InboxState>()(
  persist(
    (set, get) => ({
      open: false,
      readIds: [],

      openInbox: () => set({ open: true }),
      closeInbox: () => set({ open: false }),
      toggleInbox: () => set((s) => ({ open: !s.open })),

      markRead: (id) => {
        if (get().readIds.includes(id)) return;
        set((s) => ({ readIds: [...s.readIds, id] }));
      },

      markAllRead: (ids) => {
        const existing = new Set(get().readIds);
        let changed = false;
        for (const id of ids) {
          if (!existing.has(id)) {
            existing.add(id);
            changed = true;
          }
        }
        if (changed) set({ readIds: Array.from(existing) });
      },

      isRead: (id) => get().readIds.includes(id),
    }),
    {
      name: 'balruno:inbox',
      // 'open' 은 persist 대상 아님 — 세션 당 의도적으로 닫힌 채 시작
      partialize: (s) => ({ readIds: s.readIds }),
    },
  ),
);
