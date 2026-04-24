import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 유저 페르소나 — 첫 진입 1 회 선택. 이후 UI 가 페르소나에 맞춰 조정.
 *
 * 적용 지점:
 *  - EmptyProjectsCTA 카드 순서 (밸런서는 밸런싱 샘플 먼저)
 *  - SidebarQuickAccess 라벨 (밸런서 한정으로 "내 Sprint" 숨기거나 순서 뒤로)
 *  - InteractiveTour 기본 추천 (PM 은 스프린트 투어, 밸런서는 RPG 투어)
 *
 * '선택 안 함' (null) = 페르소나 모달 미표시 / dismiss. 이 경우 기본값은 모든 기능 노출.
 */

export type Persona = 'balancer' | 'pm' | 'analyst' | 'explorer';

interface PersonaState {
  persona: Persona | null;
  /** 모달을 본 적이 있는지 (닫기 포함). true 면 다시 자동 노출 X */
  hasChosen: boolean;

  setPersona: (p: Persona) => void;
  /** 선택 없이 닫기 — hasChosen 만 true 로 */
  dismissModal: () => void;
  /** 다시 선택 (Settings 에서 호출) */
  resetPersona: () => void;
}

export const usePersona = create<PersonaState>()(
  persist(
    (set) => ({
      persona: null,
      hasChosen: false,

      setPersona: (p) => set({ persona: p, hasChosen: true }),
      dismissModal: () => set({ hasChosen: true }),
      resetPersona: () => set({ persona: null, hasChosen: false }),
    }),
    { name: 'balruno:persona' },
  ),
);
