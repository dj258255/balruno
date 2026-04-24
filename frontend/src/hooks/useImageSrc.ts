'use client';

import { useEffect, useState } from 'react';
import { resolveImageSrc } from '@/lib/imageStorage';

/**
 * 이미지 src 리졸버 훅 — indb:<id> / data: / http(s):// 통합.
 * ObjectURL 은 unmount 시 자동 revoke.
 */
export function useImageSrc(value: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let localUrl: string | null = null;
    resolveImageSrc(value).then((resolved) => {
      if (cancelled) {
        if (resolved && resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
        return;
      }
      localUrl = resolved;
      setSrc(resolved);
    });
    return () => {
      cancelled = true;
      if (localUrl && localUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [value]);

  return src;
}
