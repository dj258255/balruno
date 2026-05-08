'use client';

/**
 * StickerLayer — placeholder pending v0.7 sticker re-instrumentation.
 *
 * The original (v0.5) implementation read `sheet.stickers`, a Y.Doc
 * field that the v0.6 cleanup removed. The server-canonical
 * replacement needs a `stickers` JSONB column on sheets + new
 * sticker.add/update/delete op kinds. Render nothing until the
 * data path is restored — keeping the mount in place so the
 * project page layout matches v0.5 visually.
 */

import type { RefObject } from 'react';

interface StickerLayerProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

export default function StickerLayer({}: StickerLayerProps) {
  return null;
}
