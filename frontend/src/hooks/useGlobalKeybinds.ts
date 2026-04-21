'use client';

/**
 * 전역 단축키 — Linear 급 키보드 조작감.
 *
 * 수정자 있는 단축키 (어떤 포커스에서도 작동):
 *   ⌘K                 CommandPalette
 *   ⌘/                 Keyboard shortcuts help
 *   ⌘⇧N                새 프로젝트
 *   ⌘N                 새 시트
 *   ⌘⇧F                Formula Helper
 *   ⌘⇧L                테마 토글
 *   ⌘⇧D                중복 프로젝트 정리
 *
 * 단일 키 (입력 포커스가 아닐 때만):
 *   ?                  단축키 헬프
 *   G                  Grid 뷰
 *   K                  Kanban 뷰
 *   C                  Calendar 뷰
 *   Y                  Gallery 뷰
 *   T                  Gantt 뷰
 *   F                  Form 뷰
 *   J / K (소문자)      행 이동 (view 가 처리 — balruno:row-nav 이벤트)
 *   E                  포커스 행 편집
 *   N                  새 행 생성
 *   D                  포커스 행 삭제
 */

import { useEffect } from 'react';

const VIEW_KEYS: Record<string, string> = {
  g: 'grid',
  k: 'kanban',
  c: 'calendar',
  y: 'gallery',
  t: 'gantt',
  f: 'form',
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // cmdk input 은 input[cmdk-input] 으로 잡힘
  return false;
}

function dispatch(name: string, detail?: unknown): void {
  window.dispatchEvent(detail !== undefined ? new CustomEvent(name, { detail }) : new Event(name));
}

export function useGlobalKeybinds(handlers: {
  toggleCommandPalette: () => void;
  toggleShortcutsHelp?: () => void;
  onNewProject?: () => void;
  onNewSheet?: () => void;
  onToggleTheme?: () => void;
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // 수정자 있는 단축키 — 입력 포커스도 우회
      if (meta && key === 'k') {
        e.preventDefault();
        handlers.toggleCommandPalette();
        return;
      }
      if (meta && key === '/') {
        e.preventDefault();
        handlers.toggleShortcutsHelp?.();
        return;
      }
      if (meta && shift && key === 'n') {
        e.preventDefault();
        handlers.onNewProject?.();
        return;
      }
      if (meta && !shift && key === 'n' && !isEditableTarget(e.target)) {
        e.preventDefault();
        handlers.onNewSheet?.();
        return;
      }
      if (meta && shift && key === 'f') {
        e.preventDefault();
        dispatch('balruno:open-panel', { panel: 'formulaHelper' });
        return;
      }
      if (meta && shift && key === 'l') {
        e.preventDefault();
        handlers.onToggleTheme?.();
        return;
      }
      if (meta && shift && key === 'd') {
        e.preventDefault();
        dispatch('balruno:open-dedupe');
        return;
      }

      // ? → shortcuts help (shift+/ 이므로 e.key 는 "?")
      // 입력 포커스가 아닐 때만.
      if (e.key === '?' && !isEditableTarget(e.target)) {
        e.preventDefault();
        handlers.toggleShortcutsHelp?.();
        return;
      }

      // 단일 키 — 입력 포커스 / 수정자 키 있을 때 무시
      if (meta || shift) return;
      if (isEditableTarget(e.target)) return;

      // 뷰 전환
      if (VIEW_KEYS[key]) {
        e.preventDefault();
        dispatch('balruno:set-view', { view: VIEW_KEYS[key] });
        return;
      }

      // 행 단축키 (view 컴포넌트가 listen)
      if (key === 'j') {
        e.preventDefault();
        dispatch('balruno:row-nav', { direction: 'down' });
      } else if (key === 'e') {
        e.preventDefault();
        dispatch('balruno:row-edit');
      } else if (key === 'd') {
        e.preventDefault();
        dispatch('balruno:row-delete');
      } else if (key === 'n' || key === '+') {
        e.preventDefault();
        dispatch('balruno:row-new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
