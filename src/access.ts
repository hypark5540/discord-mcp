import type { APIChannel } from "discord-api-types/v10";

import type { AppConfig } from "./config.js";
import type { DiscordApi } from "./discord-api.js";
import { DiscordMcpError } from "./errors.js";

function channelGuildId(channel: APIChannel): string | undefined {
  const value = (channel as unknown as Record<string, unknown>).guild_id;
  return typeof value === "string" ? value : undefined;
}

export class AccessController {
  constructor(
    private readonly config: AppConfig,
    private readonly api: DiscordApi,
  ) {}

  isGuildAllowed(guildId: string): boolean {
    return (
      this.config.allowedGuildIds.size === 0 ||
      this.config.allowedGuildIds.has(guildId)
    );
  }

  assertGuildAllowed(guildId: string): void {
    if (!this.isGuildAllowed(guildId)) {
      throw new DiscordMcpError(
        `Guild ${guildId} is blocked by DISCORD_ALLOWED_GUILD_IDS.`,
      );
    }
  }

  isChannelExplicitlyAllowed(channelId: string): boolean {
    return (
      this.config.allowedChannelIds.size === 0 ||
      this.config.allowedChannelIds.has(channelId)
    );
  }

  async assertChannelAllowed(
    channelId: string,
    signal?: AbortSignal,
  ): Promise<APIChannel> {
    if (!this.isChannelExplicitlyAllowed(channelId)) {
      throw new DiscordMcpError(
        `Channel ${channelId} is blocked by DISCORD_ALLOWED_CHANNEL_IDS.`,
      );
    }

    const channel = await this.api.getChannel(channelId, signal);
    const guildId = channelGuildId(channel);
    if (guildId === undefined) {
      throw new DiscordMcpError(
        "Direct-message and group-DM channels are not supported by this server.",
      );
    }
    this.assertGuildAllowed(guildId);
    return channel;
  }

  filterGuilds<T extends { readonly id: string }>(guilds: readonly T[]): T[] {
    return guilds.filter((guild) => this.isGuildAllowed(guild.id));
  }

  filterChannels<T extends { readonly id: string }>(
    channels: readonly T[],
  ): T[] {
    return channels.filter((channel) =>
      this.isChannelExplicitlyAllowed(channel.id),
    );
  }
}

export { channelGuildId };
