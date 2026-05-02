/**
 * Server-side i18n for API routes.
 * next-intl 의 useTranslations 는 client-only 이므로 라우트에서 직접 메시지 로드.
 */

import type { NextRequest } from 'next/server';

type Messages = Record<string, string | Record<string, unknown>>;

let cache: Record<string, Messages> = {};

async function loadMessages(locale: string): Promise<Messages> {
  if (cache[locale]) return cache[locale];
  const mod = await import(`../../messages/${locale}.json`);
  cache[locale] = mod.default as Messages;
  return cache[locale];
}

function pickLocale(req: NextRequest): 'ko' | 'en' {
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale === 'ko' || cookieLocale === 'en') return cookieLocale;
  const accept = req.headers.get('accept-language') ?? '';
  if (/^ko\b/i.test(accept) || /,\s*ko\b/i.test(accept)) return 'ko';
  if (/^en\b/i.test(accept) || /,\s*en\b/i.test(accept)) return 'en';
  return 'ko';
}

export async function getServerT(req: NextRequest, namespace: string) {
  const locale = pickLocale(req);
  const messages = await loadMessages(locale);
  const ns = (messages[namespace] ?? {}) as Record<string, string>;
  return (key: string, vars?: Record<string, string | number>) => {
    const tpl = ns[key];
    if (!tpl) return key;
    if (!vars) return tpl;
    return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  };
}
