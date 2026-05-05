import { backendBaseUrl } from './client';

export type OAuthProvider = 'github' | 'google';

/**
 * The URL the browser should navigate to in order to start an OAuth
 * authorization flow. Spring Security takes over from there: provider
 * authorize page → callback at /login/oauth2/code/{provider} → server
 * issues a JWT, drops it in the {@code balruno_session} cookie, and
 * redirects back to {@code /auth/callback?status=ok|error&error=...}.
 */
export function oauthLoginUrl(provider: OAuthProvider): string {
  return `${backendBaseUrl()}/oauth2/authorization/${provider}`;
}

/**
 * Triggers an OAuth login by full-page navigation. Use this from a
 * button click handler — the popup approach is intentionally not
 * supported because Cloudflare + cross-origin cookie semantics break
 * the third-party flow.
 */
export function startOAuthLogin(provider: OAuthProvider): void {
  if (typeof window !== 'undefined') {
    window.location.href = oauthLoginUrl(provider);
  }
}
