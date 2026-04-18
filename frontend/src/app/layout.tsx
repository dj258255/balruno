import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from "@vercel/analytics/react";
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

export const metadata: Metadata = {
  title: "발루노 - 인디게임 밸런스 툴",
  description: "인디게임 개발자를 위한 게임 밸런스 데이터 관리 툴. 엑셀보다 게임 개발에 특화된 시트 시스템과 수식을 제공합니다.",
  keywords: ["게임 밸런스", "인디게임", "게임 개발", "밸런싱 툴", "게임 기획", "발루노"],
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
