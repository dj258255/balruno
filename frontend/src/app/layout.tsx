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
  title: "Balruno — Game Studio Workspace",
  description: "게임 스튜디오를 위한 통합 워크스페이스. 밸런싱 데이터 + 스프린트 / 버그 / 에픽 로드맵을 한 곳에서. 70+ 게임 수식 (DPS/TTK/EHP/GACHA_PITY), AI Auto-Balancer, 실시간 협업, Unity/Unreal/Godot export.",
  keywords: [
    "게임 스튜디오", "game studio workspace", "게임 개발 PM", "게임 밸런스",
    "스프린트 보드", "버그 트래커", "에픽 로드맵", "실시간 협업",
    "AI Auto-Balancer", "몬테카를로 시뮬", "가챠 시뮬",
    "Jira alternative games", "Codecks alternative", "Airtable for games",
    "indie studio workspace", "발루노", "Balruno",
  ],
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
