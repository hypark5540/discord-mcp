import { DiscordAPIError, HTTPError, RateLimitError } from "@discordjs/rest";

export class DiscordMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordMcpError";
  }
}

export function translateDiscordError(error: unknown): DiscordMcpError {
  if (error instanceof RateLimitError) {
    return new DiscordMcpError(
      "Discord rate limit was reached. Wait briefly and try again.",
    );
  }

  if (error instanceof DiscordAPIError || error instanceof HTTPError) {
    switch (error.status) {
      case 400:
        return new DiscordMcpError(
          "Discord rejected the request as invalid. Check the supplied IDs and content.",
        );
      case 401:
        return new DiscordMcpError(
          "Discord rejected the bot token. Check DISCORD_TOKEN.",
        );
      case 403:
        return new DiscordMcpError(
          "The Discord bot does not have permission for this operation.",
        );
      case 404:
        return new DiscordMcpError(
          "The requested Discord guild, channel, or message was not found.",
        );
      case 429:
        return new DiscordMcpError(
          "Discord rate limit was reached. Wait briefly and try again.",
        );
      default:
        return new DiscordMcpError(
          `Discord API request failed (HTTP ${error.status}).`,
        );
    }
  }

  if (error instanceof TypeError) {
    return new DiscordMcpError(
      "Could not reach the Discord API. Check the network connection and try again.",
    );
  }

  if (error instanceof DiscordMcpError) {
    return error;
  }

  return new DiscordMcpError("An unexpected Discord API error occurred.");
}
