import { request } from './client';

/**
 * Anonymous landing-page demo (ADR 0035). The backend issues a
 * balruno_session cookie bound to the seeded demo user; the
 * response body just hands back the slugs the frontend needs to
 * route into the demo project.
 */
export interface AnonymousDemoSession {
  displayName: string;
  workspaceSlug: string;
  projectSlug: string;
}

export async function startAnonymousDemoSession(): Promise<AnonymousDemoSession> {
  return request<AnonymousDemoSession>('/api/v1/demo/anonymous-session', {
    method: 'POST',
  });
}
