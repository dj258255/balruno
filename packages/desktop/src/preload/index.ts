/**
 * Preload script — main 과 renderer 사이 안전한 IPC 브릿지.
 *
 * contextBridge 로 window.balruno 노출:
 * - kvStorage: sync IPC (electron-store)
 * - platform: async IPC (dialog.showSaveDialog)
 *
 * renderer (packages/web 의 next 앱) 가 이를 감지하면 web 어댑터 대신 desktop 어댑터 주입.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('balruno', {
  kvStorage: {
    get(key: string): string | null {
      return ipcRenderer.sendSync('kv-storage:get', key);
    },
    set(key: string, value: string): void {
      ipcRenderer.sendSync('kv-storage:set', key, value);
    },
    remove(key: string): void {
      ipcRenderer.sendSync('kv-storage:remove', key);
    },
  },
  platform: {
    async downloadFile(
      content: string | ArrayBuffer | Uint8Array,
      filename: string,
      mimeType?: string,
    ): Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }> {
      const data =
        content instanceof ArrayBuffer ? new Uint8Array(content) : content;
      return ipcRenderer.invoke('dialog:save-file', { content: data, filename, mimeType });
    },
  },
  isDesktop: true,
});
