/**
 * Auto-update — electron-updater + GitHub Releases.
 *
 * production 빌드 시 GitHub Releases 의 latest tag 를 주기적으로 확인 → 업데이트 발견 시
 * 백그라운드 다운로드 → 사용자에게 "재시작 시 적용" 알림.
 *
 * dev 모드에서는 비활성 (빌드된 앱에서만 동작).
 *
 * publish 설정: package.json 의 build.publish (provider: github) 에서 처리.
 *
 * 첫 release 흐름:
 *   1. git tag v0.1.0 && git push --tags
 *   2. GitHub Actions 가 npm run package:mac/win/linux 실행 → release 자산 업로드
 *   3. 또는 로컬에서 GH_TOKEN 환경변수 + npm run package -- --publish always
 */

import { autoUpdater } from 'electron-updater';
import { app, dialog } from 'electron';
import log from 'node:console';

export function initAutoUpdate(): void {
  if (!app.isPackaged) {
    log.log('[autoUpdate] dev 모드 — auto-update 비활성');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log.log('[autoUpdate] 업데이트 발견', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.log('[autoUpdate] 업데이트 다운로드 완료', info.version);
    void dialog
      .showMessageBox({
        type: 'info',
        buttons: ['지금 재시작', '나중에'],
        defaultId: 0,
        title: 'PowerBalance 업데이트',
        message: `새 버전 ${info.version} 이 준비됐습니다`,
        detail: '재시작하면 즉시 적용됩니다.',
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    log.error('[autoUpdate] error', err);
  });

  // 30분마다 체크
  void autoUpdater.checkForUpdates();
  setInterval(
    () => {
      void autoUpdater.checkForUpdates();
    },
    30 * 60 * 1000,
  );
}
