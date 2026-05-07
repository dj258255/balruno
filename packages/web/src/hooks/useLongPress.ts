/**
 * Long-press → synthetic contextmenu (ADR 0022 v1.2 stage D).
 *
 * On touch devices, drag-and-drop is unusable (would need a second
 * finger to scroll the page) and right-click doesn't exist. The
 * accepted alternative is long-press: hold a finger on a target for
 * 600ms, then a context menu pops up (Notion / Airtable / iOS
 * Files all do this).
 *
 * The hook returns event handlers that should be spread onto the
 * target element. It dispatches a synthetic 'contextmenu' event on
 * the same element so existing onContextMenu handlers work
 * unchanged — no per-component fork.
 *
 * Cancellation rules (browser conventions):
 *   - touchmove > 10px: user is scrolling, not pressing → cancel
 *   - touchend before 600ms: tap → cancel
 *   - touchcancel: system interrupted → cancel
 */

import { useCallback, useRef } from 'react';

const HOLD_MS = 600;
const CANCEL_DISTANCE_PX = 10;

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
}

export function useLongPress(): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    const target = e.currentTarget as HTMLElement;
    timerRef.current = setTimeout(() => {
      // Synthesise a contextmenu event at the touch coords. The
      // existing onContextMenu handlers (registered on the same
      // element) read clientX/clientY, so the menu pops at the
      // correct location.
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      target.dispatchEvent(event);
      timerRef.current = null;
      startPosRef.current = null;
    }, HOLD_MS);
  }, [cancel]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startPosRef.current.x;
    const dy = touch.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > CANCEL_DISTANCE_PX) {
      cancel();
    }
  }, [cancel]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}
