import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Analytics } from "@vercel/analytics/next";
import { DesktopBootstrap } from "./components/DesktopBootstrap";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/**
 * Viewport 설정 - 모바일 반응형 지원
 * 참고: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 *
 * - width: device-width - 디바이스 너비에 맞춤
 * - initialScale: 1 - 초기 줌 레벨
 * - maximumScale: 5 - 접근성 가이드라인에 따라 최대 5배 줌 허용
 * - userScalable: true - 접근성을 위해 사용자 확대/축소 허용
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // 노치 디바이스 지원
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: "Balruno — Game Studio Workspace",
    description: t('metaDescription'),
    keywords: t('metaKeywords').split(','),
    icons: {
      icon: [
        {
          url: '/icon.svg',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/icon-dark.svg',
          media: '(prefers-color-scheme: dark)',
        },
      ],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <DesktopBootstrap />
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
