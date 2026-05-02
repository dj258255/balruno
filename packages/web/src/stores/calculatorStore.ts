/**
 * Calculator store — 마지막 결과값 (`ans`) 을 탭 간 공유.
 * Desmos 의 `ans` 키워드, macOS Calculator 의 "M+/MR" 메모리 기능 근사.
 *
 * 탭을 전환해도 이전 결과를 그대로 다음 입력에 끌어올 수 있게.
 */
import { create } from 'zustand';

interface CalculatorStore {
  /** 최근 결과값 (가장 의미 있는 숫자 하나) */
  ans: number | null;
  /** 결과에 대한 라벨 ("DPS", "EHP" 등) */
  ansLabel: string | null;
  setAns: (value: number, label: string) => void;
  clear: () => void;
}

export const useCalculatorStore = create<CalculatorStore>((set) => ({
  ans: null,
  ansLabel: null,
  setAns: (value, label) => set({ ans: value, ansLabel: label }),
  clear: () => set({ ans: null, ansLabel: null }),
}));
