import { describe, expect, it } from "vitest";

import {
  normalizeChannel,
  normalizeGuild,
  normalizeMessage,
  normalizePartialGuild,
  normalizeUser,
} from "../src/normalize.js";
import {
  BOT_USER,
  CHANNEL_ID,
  OTHER_CHANNEL_ID,
  OTHER_USER,
  TEST_CHANNEL,
  TEST_GUILD,
  TEST_MESSAGE,
  TEST_PARTIAL_GUILD,
} from "./fixtures.js";

describe("Discord payload normalization", () => {
  it("normalizes users and guilds with present and absent optional fields", () => {
    expect(normalizeUser(BOT_USER)).toMatchObject({
      global_name: "Discord MCP Test",
      bot: true,
      avatar: null,
    });
    expect(
      normalizeUser({
        ...OTHER_USER,
        global_name: null,
        avatar: "avatar-hash",
        bot: undefined,
      } as never),
    ).toMatchObject({ global_name: null, bot: false, avatar: "avatar-hash" });

    expect(normalizePartialGuild(TEST_PARTIAL_GUILD)).toMatchObject({
      approximate_member_count: 3,
      approximate_presence_count: 2,
    });
    expect(
      normalizePartialGuild({
        ...TEST_PARTIAL_GUILD,
        approximate_member_count: undefined,
        approximate_presence_count: undefined,
      } as never),
    ).toMatchObject({
      approximate_member_count: null,
      approximate_presence_count: null,
    });

    expect(normalizeGuild(TEST_GUILD)).toMatchObject({
      approximate_member_count: 3,
      approximate_presence_count: 2,
    });
    expect(
      normalizeGuild({
        ...TEST_GUILD,
        approximate_member_count: undefined,
        approximate_presence_count: undefined,
      } as never),
    ).toMatchObject({
      approximate_member_count: null,
      approximate_presence_count: null,
    });
  });

  it("names known, future, and malformed channel types safely", () => {
    expect(normalizeChannel(TEST_CHANNEL)).toMatchObject({
      type: 0,
      type_name: "GuildText",
      guild_id: expect.any(String),
      position: 0,
      nsfw: false,
    });
    expect(
      normalizeChannel({ id: CHANNEL_ID, type: 99 } as never),
    ).toMatchObject({ type: 99, type_name: "Unknown(99)" });
    expect(
      normalizeChannel({ id: CHANNEL_ID, type: "invalid" } as never),
    ).toEqual({
      id: CHANNEL_ID,
      guild_id: null,
      type: -1,
      type_name: "Unknown",
      name: null,
      topic: null,
      parent_id: null,
      position: null,
      nsfw: null,
      last_message_id: null,
      rate_limit_per_user: null,
    });
  });

  it("keeps same-channel reply context", () => {
    const result = normalizeMessage({
      ...TEST_MESSAGE,
      components: undefined,
      referenced_message: {
        ...TEST_MESSAGE,
        id: "323456789012345679",
      },
    } as never);

    expect(result.referenced_message).toMatchObject({
      channel_id: CHANNEL_ID,
      content: TEST_MESSAGE.content,
      redacted: false,
    });
  });

  it("redacts cross-channel referenced message content", () => {
    const result = normalizeMessage({
      ...TEST_MESSAGE,
      referenced_message: {
        ...TEST_MESSAGE,
        id: "323456789012345679",
        channel_id: OTHER_CHANNEL_ID,
        content: "secret content from a blocked parent channel",
      },
    });

    expect(result.referenced_message).toEqual({
      id: "323456789012345679",
      channel_id: OTHER_CHANNEL_ID,
      redacted: true,
      redaction_reason: "cross_channel_reference",
    });
    expect(JSON.stringify(result)).not.toContain("secret content");
  });

  it("normalizes rich message boundaries without leaking snapshots", () => {
    const result = normalizeMessage({
      ...TEST_MESSAGE,
      flags: undefined,
      guild_id: undefined,
      webhook_id: "webhook-id",
      mentions: [OTHER_USER],
      mention_roles: ["623456789012345678"],
      attachments: [
        {
          id: "723456789012345678",
          filename: "with-metadata.txt",
          description: "description",
          content_type: "text/plain",
          size: 12,
          url: "https://cdn.discord.test/file",
          width: 10,
          height: 20,
        },
        {
          id: "723456789012345679",
          filename: "without-metadata.txt",
          size: 0,
          url: "https://cdn.discord.test/empty",
        },
      ],
      embeds: [
        {
          type: "rich",
          title: "Title",
          description: "Description",
          url: "https://discord.test/embed",
          timestamp: "2026-07-22T00:00:00.000Z",
          author: { name: "Author", url: "https://discord.test/author" },
          footer: { text: "Footer" },
          fields: [
            { name: "A", value: "1", inline: true },
            { name: "B", value: "2" },
          ],
        },
        { type: "rich", author: { name: "Author without URL" } },
        { type: "rich" },
      ],
      components: [{ type: 1, components: [] }],
      poll: { question: { text: "Question" } },
      message_snapshots: [{ message: {} }],
      reactions: [
        {
          emoji: { id: null, name: "👍" },
          count: 2,
          me: true,
        },
      ],
      message_reference: { message_id: "823456789012345678" },
      referenced_message: null,
    } as never);

    expect(result).toMatchObject({
      flags: 0,
      guild_id: null,
      webhook_id: "webhook-id",
      components: [{ type: 1, components: [] }],
      poll: { question: { text: "Question" } },
      message_snapshots: [
        {
          redacted: true,
          redaction_reason: "forwarded_message_boundary",
        },
      ],
      referenced_message: null,
    });
    expect(result.attachments).toHaveLength(2);
    expect(result.embeds).toHaveLength(3);
    expect(result.reactions).toHaveLength(1);
  });
});
