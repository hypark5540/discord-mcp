import { vi } from "vitest";
import {
  ChannelType,
  MessageType,
  type APIChannel,
  type APIGuild,
  type APIMessage,
  type APIUser,
  type RESTAPIPartialCurrentUserGuild,
} from "discord-api-types/v10";

import type { AppConfig } from "../src/config.js";
import type { DiscordApi } from "../src/discord-api.js";

export const GUILD_ID = "123456789012345678";
export const OTHER_GUILD_ID = "123456789012345679";
export const CHANNEL_ID = "223456789012345678";
export const OTHER_CHANNEL_ID = "223456789012345679";
export const MESSAGE_ID = "323456789012345678";
export const BOT_ID = "423456789012345678";
export const OTHER_USER_ID = "523456789012345678";

export const BOT_USER = {
  id: BOT_ID,
  username: "discord-mcp-test",
  discriminator: "0",
  global_name: "Discord MCP Test",
  avatar: null,
  bot: true,
} as APIUser;

export const OTHER_USER = {
  ...BOT_USER,
  id: OTHER_USER_ID,
  username: "other-user",
  global_name: "Other User",
  bot: false,
} as APIUser;

export const TEST_CHANNEL = {
  id: CHANNEL_ID,
  guild_id: GUILD_ID,
  type: ChannelType.GuildText,
  name: "general",
  position: 0,
  permission_overwrites: [],
  nsfw: false,
  topic: "Test channel",
  last_message_id: MESSAGE_ID,
  rate_limit_per_user: 0,
  parent_id: null,
} as APIChannel;

export const TEST_MESSAGE = {
  id: MESSAGE_ID,
  type: MessageType.Default,
  channel_id: CHANNEL_ID,
  guild_id: GUILD_ID,
  author: BOT_USER,
  content: "hello from the bot",
  timestamp: "2026-07-21T10:00:00.000Z",
  edited_timestamp: null,
  tts: false,
  mention_everyone: false,
  mentions: [],
  mention_roles: [],
  attachments: [],
  embeds: [],
  pinned: false,
  flags: 0,
  components: [],
} as unknown as APIMessage;

export const TEST_GUILD = {
  id: GUILD_ID,
  name: "Test Guild",
  icon: null,
  banner: null,
  owner_id: OTHER_USER_ID,
  description: "A test guild",
  preferred_locale: "ko",
  verification_level: 0,
  approximate_member_count: 3,
  approximate_presence_count: 2,
  features: [],
} as unknown as APIGuild;

export const TEST_PARTIAL_GUILD = {
  id: GUILD_ID,
  name: "Test Guild",
  icon: null,
  banner: null,
  owner: false,
  permissions: "1024",
  features: [],
  approximate_member_count: 3,
  approximate_presence_count: 2,
} as RESTAPIPartialCurrentUserGuild;

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    token: "test-token",
    writesEnabled: false,
    deletesEnabled: false,
    unrestrictedWritesEnabled: false,
    allowedGuildIds: new Set<string>(),
    allowedChannelIds: new Set<string>(),
    maxResponseChars: 50_000,
    ...overrides,
  };
}

export function makeMockApi() {
  return {
    getCurrentUser: vi.fn(async () => BOT_USER),
    listCurrentUserGuilds: vi.fn(async () => [TEST_PARTIAL_GUILD]),
    getGuild: vi.fn(async () => TEST_GUILD),
    listGuildChannels: vi.fn(async () => [TEST_CHANNEL]),
    listGuildActiveThreads: vi.fn(async () => []),
    getChannel: vi.fn(async () => TEST_CHANNEL),
    listMessages: vi.fn(async () => [TEST_MESSAGE]),
    getMessage: vi.fn(async () => TEST_MESSAGE),
    createMessage: vi.fn(async () => TEST_MESSAGE),
    editMessage: vi.fn(async () => ({ ...TEST_MESSAGE, content: "edited" })),
    deleteMessage: vi.fn(async () => undefined),
  } satisfies DiscordApi;
}

export type MockDiscordApi = ReturnType<typeof makeMockApi>;
