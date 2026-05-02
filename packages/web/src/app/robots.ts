import type { MetadataRoute } from 'next';

/**
 * SITE URL 우선순위:
 *   1. NEXT_PUBLIC_SITE_URL  (커스텀 도메인 붙이면 .env 에 명시)
 *   2. VERCEL_URL            (Vercel 빌드/배포 시 자동 주입, 호스트만 — protocol 없음)
 *   3. fallback              (로컬/미설정)
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/_vercel/'],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'anthropic-ai', 'PerplexityBot', 'cohere-ai'],
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
