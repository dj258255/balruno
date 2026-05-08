/**
 * REST client for Discord workspace links (ADR 0030).
 */

import { request } from './client';

export interface DiscordLink {
  id: string;
  workspaceId: string;
  discordGuildId: string;
  discordApplicationId: string;
  discordPublicKey: string;
  discordBotToken: string | null;
  defaultSheetId: string | null;
  active: boolean;
  lastInteractionAt: string | null;
  lastStatus: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateDiscordLinkInput {
  discordGuildId: string;
  discordApplicationId: string;
  discordPublicKey: string;
  discordBotToken: string;
  defaultSheetId?: string | null;
}

export function createDiscordLink(
  workspaceId: string,
  input: CreateDiscordLinkInput,
): Promise<DiscordLink> {
  return request<DiscordLink>(`/api/v1/workspaces/${workspaceId}/discord-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listDiscordLinks(workspaceId: string): Promise<DiscordLink[]> {
  return request<DiscordLink[]>(`/api/v1/workspaces/${workspaceId}/discord-links`);
}

export async function deleteDiscordLink(id: string): Promise<void> {
  await request<void>(`/api/v1/discord-links/${id}`, { method: 'DELETE' });
}
