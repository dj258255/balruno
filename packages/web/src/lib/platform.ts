/**
 * Platform — 파일 다운로드 / 시스템 통합 추상화
 *
 * web: <a download> 트릭으로 브라우저 다운로드 트리거
 * desktop: Electron dialog.showSaveDialog + fs.writeFile
 * mobile: 추후 share API
 */

export interface PlatformAdapter {
  downloadFile(content: string | Blob, filename: string, mimeType?: string): Promise<void>;
}

let activePlatform: PlatformAdapter | null = null;

export function setPlatform(p: PlatformAdapter): void {
  activePlatform = p;
}

export const platform: PlatformAdapter = {
  async downloadFile(content, filename, mimeType) {
    return (activePlatform ?? webPlatform).downloadFile(content, filename, mimeType);
  },
};

/** 기본 web 구현 — SSR 안전 */
export const webPlatform: PlatformAdapter = {
  async downloadFile(content, filename, mimeType = 'application/octet-stream') {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
