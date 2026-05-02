'use client';

import { useRouter } from 'next/navigation';
import { useLocale as useNextIntlLocale } from 'next-intl';

export type Locale = 'ko' | 'en';

export function useLocaleSwitch() {
  const locale = useNextIntlLocale() as Locale;
  const router = useRouter();

  const setLocale = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  return { locale, setLocale };
}
