import { randomBytes } from "node:crypto";

import { REST, type RequestData } from "@discordjs/rest";
import {
  Routes,
  type APIChannel,
  type APIGuild,
  type APIMessage,
  type APIUser,
  type RESTAPIPartialCurrentUserGuild,
  type RESTGetAPIChannelMessageResult,
  type RESTGetAPIChannelMessagesResult,
  type RESTGetAPIChannelResult,
  type RESTGetAPICurrentUserGuildsResult,
  type RESTGetAPICurrentUserResult,
  type RESTGetAPIGuildChannelsResult,
  type RESTGetAPIGuildResult,
  type RESTGetAPIGuildThreadsResult,
  type RESTPatchAPIChannelMessageResult,
  type RESTPostAPIChannelMessageJSONBody,
  type RESTPostAPIChannelMessageResult,
} from "discord-api-types/v10";

import { translateDiscordError } from "./errors.js";
import { VERSION } from "./version.js";

export interface GuildListOptions {
  readonly limit: number;
  readonly before?: string | undefined;
  readonly after?: string | undefined;
}

export interface MessageListOptions {
  readonly limit: number;
  readonly before?: string | undefined;
  readonly after?: string | undefined;
  readonly around?: string | undefined;
}

export interface CreateMessageOptions {
  readonly content: string;
  readonly replyToMessageId?: string | undefined;
}

export type DiscordChannel =
  | APIChannel
  | RESTGetAPIGuildChannelsResult[number];

export interface DiscordApi {
  getCurrentUser(signal?: AbortSignal | undefined): Promise<APIUser>;
  listCurrentUserGuilds(
    options: GuildListOptions,
    signal?: AbortSignal | undefined,
  ): Promise<RESTAPIPartialCurrentUserGuild[]>;
  getGuild(guildId: string, signal?: AbortSignal | undefined): Promise<APIGuild>;
  listGuildChannels(
    guildId: string,
    signal?: AbortSignal | undefined,
  ): Promise<DiscordChannel[]>;
  listGuildActiveThreads(
    guildId: string,
    signal?: AbortSignal | undefined,
  ): Promise<DiscordChannel[]>;
  getChannel(
    channelId: string,
    signal?: AbortSignal | undefined,
  ): Promise<APIChannel>;
  listMessages(
    channelId: string,
    options: MessageListOptions,
    signal?: AbortSignal | undefined,
  ): Promise<APIMessage[]>;
  getMessage(
    channelId: string,
    messageId: string,
    signal?: AbortSignal | undefined,
  ): Promise<APIMessage>;
  createMessage(
    channelId: string,
    options: CreateMessageOptions,
    signal?: AbortSignal | undefined,
  ): Promise<APIMessage>;
  editMessage(
    channelId: string,
    messageId: string,
    content: string,
    signal?: AbortSignal | undefined,
  ): Promise<APIMessage>;
  deleteMessage(
    channelId: string,
    messageId: string,
    signal?: AbortSignal | undefined,
  ): Promise<void>;
}

export type RestClient = Pick<REST, "get" | "post" | "patch" | "delete">;

function addOptionalQuery(
  query: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    query.set(key, value);
  }
}

function withSignal(
  signal: AbortSignal | undefined,
  data: RequestData = {},
): RequestData {
  return signal === undefined ? data : { ...data, signal };
}

export class DiscordRestApi implements DiscordApi {
  private readonly rest: RestClient;

  constructor(token: string, rest?: RestClient) {
    this.rest =
      rest ??
      new REST({
        version: "10",
        retries: 2,
        timeout: 15_000,
        userAgentAppendix: `discord-mcp/${VERSION}`,
      }).setToken(token);
  }

  async getCurrentUser(signal?: AbortSignal): Promise<APIUser> {
    return this.request<RESTGetAPICurrentUserResult>(() =>
      this.rest.get(Routes.user(), withSignal(signal)),
    );
  }

  async listCurrentUserGuilds(
    options: GuildListOptions,
    signal?: AbortSignal,
  ): Promise<RESTAPIPartialCurrentUserGuild[]> {
    const query = new URLSearchParams({
      limit: String(options.limit),
      with_counts: "true",
    });
    addOptionalQuery(query, "before", options.before);
    addOptionalQuery(query, "after", options.after);

    return this.request<RESTGetAPICurrentUserGuildsResult>(() =>
      this.rest.get(Routes.userGuilds(), withSignal(signal, { query })),
    );
  }

  async getGuild(guildId: string, signal?: AbortSignal): Promise<APIGuild> {
    const query = new URLSearchParams({ with_counts: "true" });
    return this.request<RESTGetAPIGuildResult>(() =>
      this.rest.get(Routes.guild(guildId), withSignal(signal, { query })),
    );
  }

  async listGuildChannels(
    guildId: string,
    signal?: AbortSignal,
  ): Promise<DiscordChannel[]> {
    return this.request<RESTGetAPIGuildChannelsResult>(() =>
      this.rest.get(Routes.guildChannels(guildId), withSignal(signal)),
    );
  }

  async listGuildActiveThreads(
    guildId: string,
    signal?: AbortSignal,
  ): Promise<DiscordChannel[]> {
    const result = await this.request<RESTGetAPIGuildThreadsResult>(() =>
      this.rest.get(Routes.guildActiveThreads(guildId), withSignal(signal)),
    );
    return result.threads;
  }

  async getChannel(
    channelId: string,
    signal?: AbortSignal,
  ): Promise<APIChannel> {
    return this.request<RESTGetAPIChannelResult>(() =>
      this.rest.get(Routes.channel(channelId), withSignal(signal)),
    );
  }

  async listMessages(
    channelId: string,
    options: MessageListOptions,
    signal?: AbortSignal,
  ): Promise<APIMessage[]> {
    const query = new URLSearchParams({ limit: String(options.limit) });
    addOptionalQuery(query, "before", options.before);
    addOptionalQuery(query, "after", options.after);
    addOptionalQuery(query, "around", options.around);

    return this.request<RESTGetAPIChannelMessagesResult>(() =>
      this.rest.get(
        Routes.channelMessages(channelId),
        withSignal(signal, { query }),
      ),
    );
  }

  async getMessage(
    channelId: string,
    messageId: string,
    signal?: AbortSignal,
  ): Promise<APIMessage> {
    return this.request<RESTGetAPIChannelMessageResult>(() =>
      this.rest.get(
        Routes.channelMessage(channelId, messageId),
        withSignal(signal),
      ),
    );
  }

  async createMessage(
    channelId: string,
    options: CreateMessageOptions,
    signal?: AbortSignal,
  ): Promise<APIMessage> {
    const body: RESTPostAPIChannelMessageJSONBody = {
      content: options.content,
      allowed_mentions: { parse: [], replied_user: false },
      nonce: randomBytes(12).toString("hex"),
      enforce_nonce: true,
    };

    if (options.replyToMessageId !== undefined) {
      body.message_reference = {
        message_id: options.replyToMessageId,
        fail_if_not_exists: true,
      };
    }

    return this.request<RESTPostAPIChannelMessageResult>(() =>
      this.rest.post(
        Routes.channelMessages(channelId),
        withSignal(signal, { body }),
      ),
    );
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<APIMessage> {
    return this.request<RESTPatchAPIChannelMessageResult>(() =>
      this.rest.patch(
        Routes.channelMessage(channelId, messageId),
        withSignal(signal, {
          body: {
            content,
            allowed_mentions: { parse: [], replied_user: false },
          },
        }),
      ),
    );
  }

  async deleteMessage(
    channelId: string,
    messageId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.request<undefined>(() =>
      this.rest.delete(
        Routes.channelMessage(channelId, messageId),
        withSignal(signal),
      ),
    );
  }

  private async request<T>(operation: () => Promise<unknown>): Promise<T> {
    try {
      return (await operation()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      throw translateDiscordError(error);
    }
  }
}
