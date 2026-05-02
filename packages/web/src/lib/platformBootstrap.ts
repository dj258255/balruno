/**
 * Platform bootstrap — 런타임에 Electron preload (window.balruno) 가 있으면
 * desktop 어댑터를 주입한다. web 환경에서는 no-op (기본 web 어댑터 유지).
 *
 * 호출 시점: app/layout.tsx 또는 client entry 의 최상단에서 1회.
 */

import { setKvStorage, type KeyValueStorage } from './kvStorage';
import { setPlatform, type PlatformAdapter } from './platform';

interface BalrunoBridge {
  kvStorage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  };
  platform: {
    downloadFile(
      content: string | ArrayBuffer | Uint8Array,
      filename: string,
      mimeType?: string,
    ): Promise<unknown>;
  };
  isDesktop: boolean;
}

declare global {
  interface Window {
    balruno?: BalrunoBridge;
  }
}

let bootstrapped = false;

export function bootstrapDesktopAdapters(): void {
  if (bootstrapped) return;
  if (typeof window === 'undefined') return;
  if (!window.balruno?.isDesktop) return;

  const bridge = window.balruno;

  const desktopKv: KeyValueStorage = {
    get: (key) => bridge.kvStorage.get(key),
    set: (key, value) => bridge.kvStorage.set(key, value),
    remove: (key) => bridge.kvStorage.remove(key),
  };
  setKvStorage(desktopKv);

  const desktopPlatform: PlatformAdapter = {
    async downloadFile(content, filename, mimeType) {
      // Blob → ArrayBuffer 변환 (IPC 직렬화 가능 형식)
      const data =
        content instanceof Blob ? new Uint8Array(await content.arrayBuffer()) : content;
      await bridge.platform.downloadFile(data, filename, mimeType);
    },
  };
  setPlatform(desktopPlatform);

  bootstrapped = true;
  // eslint-disable-next-line no-console
  console.log('[balruno] desktop adapters bootstrapped');
}
