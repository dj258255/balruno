/**
 * KeyValueStorage — 플랫폼 추상화 인터페이스 (동기 API)
 *
 * 목적: lib/ 안의 모듈이 localStorage 에 직접 의존하지 않게 한다.
 * web 은 localStorage, desktop(Electron) 은 electron-store (renderer 에서 sync IPC) 로 매핑.
 * mobile 의 AsyncStorage 같은 비동기-only 환경은 future 인터페이스 분리 시점에 검토.
 *
 * 사용:
 *   import { kvStorage } from '@/lib/storage';
 *   kvStorage.set('foo', 'bar');
 *   const v = kvStorage.get('foo');
 *
 * 플랫폼별 구현은 entry-point (web/desktop) 에서 setKvStorage() 로 주입.
 * 기본은 web 구현 (브라우저 환경 가정, SSR 안전).
 */

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

let activeStorage: KeyValueStorage | null = null;

export function setKvStorage(storage: KeyValueStorage): void {
  activeStorage = storage;
}

export const kvStorage: KeyValueStorage = {
  get(key) {
    return (activeStorage ?? webStorage).get(key);
  },
  set(key, value) {
    (activeStorage ?? webStorage).set(key, value);
  },
  remove(key) {
    (activeStorage ?? webStorage).remove(key);
  },
};

/** 기본 web 구현 — SSR 안전 */
export const webStorage: KeyValueStorage = {
  get(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  remove(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};
