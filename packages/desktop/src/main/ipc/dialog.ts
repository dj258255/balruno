/**
 * Dialog IPC — renderer 의 platform.downloadFile 어댑터를 desktop dialog 와 연결.
 *
 * renderer 에서 window.balruno.platform.downloadFile(blob, filename) 호출 시
 * preload script 가 ipcRenderer.invoke 로 main 에 전달.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';

export function registerDialogHandlers(): void {
  ipcMain.handle(
    'dialog:save-file',
    async (event, args: { filename: string; content: string | Uint8Array; mimeType?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, error: 'no window' };

      const result = await dialog.showSaveDialog(win, {
        defaultPath: args.filename,
        title: '파일로 저장',
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      try {
        const data = typeof args.content === 'string' ? args.content : Buffer.from(args.content);
        await fs.writeFile(result.filePath, data);
        return { success: true, path: result.filePath };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
