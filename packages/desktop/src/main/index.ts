/**
 * Electron main process — PowerBalance / balruno
 *
 * 책임:
 * - BrowserWindow 생성 + 라이프사이클 관리
 * - dev: http://localhost:3000 (packages/web 의 next dev) 로드
 * - prod: 정적 빌드 결과 (file://) 로드
 * - IPC 핸들러 등록 (storage / dialog 등)
 */

import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { registerStorageHandlers } from './ipc/storage';
import { registerDialogHandlers } from './ipc/dialog';

const isDev = process.env.NODE_ENV === 'development';

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'PowerBalance',
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // electron-store sync IPC 위해
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../../../web/.next/standalone/index.html'));
  }

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return win;
}

app.whenReady().then(() => {
  registerStorageHandlers();
  registerDialogHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
