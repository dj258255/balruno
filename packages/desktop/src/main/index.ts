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
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { registerStorageHandlers } from './ipc/storage.js';
import { registerDialogHandlers } from './ipc/dialog.js';
import { initAutoUpdate } from './autoUpdate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// Production: load the bundled Next.js standalone server in this same process
// (no child_process). One process => one Dock icon (no stray "exec" tile).
const PROD_PORT = '3939';
let serverStarted = false;

function startNextServer(): Promise<string> {
  if (serverStarted) return Promise.resolve(`http://127.0.0.1:${PROD_PORT}`);

  // app layout (production):
  //   Contents/Resources/app.asar/dist/main/index.js  ← __dirname here
  //   Contents/Resources/web/.next/standalone/packages/web/server.js  ← extraResources
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', '..');
  const serverScript = path.join(
    resourcesPath,
    'web',
    '.next',
    'standalone',
    'packages',
    'web',
    'server.js',
  );

  // The standalone server.js is CJS and uses require('next'). We must execute
  // it via a require() function rooted at its own location so that
  // node_modules resolution works (../../node_modules/next).
  process.env.PORT = PROD_PORT;
  process.env.HOSTNAME = '127.0.0.1';
  process.env.NODE_ENV = 'production';

  const requireFromServer = createRequire(serverScript);
  // Load + execute server.js in-process. It calls .listen(PORT) synchronously
  // during module load; no further await needed.
  requireFromServer(serverScript);
  serverStarted = true;

  // Wait briefly for the listen() to be ready before loadURL.
  return new Promise((resolveStarted) => {
    setTimeout(() => resolveStarted(`http://127.0.0.1:${PROD_PORT}`), 800);
  });
}

async function createMainWindow(): Promise<BrowserWindow> {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Balruno',
    backgroundColor: '#0a0a0a',
    // Mac: hiddenInset (traffic lights 만 보임, frameless 모던 룩)
    // Windows: hidden + titleBarOverlay (우측 상단 시스템 컨트롤 자동 그림)
    // Linux: default (DE 의 기본 titlebar 사용 — 데스크톱 환경마다 다름)
    titleBarStyle: isMac ? 'hiddenInset' : isWin ? 'hidden' : 'default',
    // Mac 전용: traffic lights 위치 — 위쪽 컴팩트한 22px 영역에 배치 (Linear/Notion 패턴)
    ...(isMac && { trafficLightPosition: { x: 12, y: 6 } }),
    // Windows 전용: 우측 상단 시스템 컨트롤 영역 색상 (frameless 모던 룩)
    ...(isWin && {
      titleBarOverlay: {
        color: '#0a0a0a',
        symbolColor: '#ffffff',
        height: 32,
      },
    }),
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
    const url = await startNextServer();
    win.loadURL(url);
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

app.whenReady().then(async () => {
  registerStorageHandlers();
  registerDialogHandlers();
  await createMainWindow();
  initAutoUpdate();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// In-process server shuts down with the app — no manual teardown needed.
