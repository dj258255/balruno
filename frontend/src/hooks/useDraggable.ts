/**
 * Draggable panel 의 위치/크기 타입 정의.
 *
 * 원래 useDraggable / usePanelManager 훅도 있었으나 사용처가 없어 제거됨.
 * 타입만 ToolPanelRenderer / FloatingPanelLayout 의 prop 시그니처에 사용 (이전 버전).
 * 현재는 DraggableState 만 외부에서 import (다른 panel layout 컴포넌트들이 prop 으로 받음).
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DraggableState extends Position, Size {
  zIndex: number;
}
