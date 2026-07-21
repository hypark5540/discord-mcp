import { describe, expect, it, vi } from "vitest";

import {
  DiscordRestApi,
  type RestClient,
} from "../src/discord-api.js";
import {
  BOT_USER,
  CHANNEL_ID,
  GUILD_ID,
  MESSAGE_ID,
  TEST_CHANNEL,
  TEST_GUILD,
  TEST_MESSAGE,
  TEST_PARTIAL_GUILD,
} from "./fixtures.js";

function makeRestMock() {
  const get = vi.fn();
  const post = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return {
    rest: { get, post, patch, delete: del } as unknown as RestClient,
    get,
    post,
    patch,
    del,
  };
}

describe("DiscordRestApi", () => {
  it("constructs its own REST client when one is not injected", () => {
    expect(new DiscordRestApi("unused-test-token")).toBeInstanceOf(
      DiscordRestApi,
    );
  });

  it("forwards every read and delete operation to Discord", async () => {
    const mock = makeRestMock();
    const api = new DiscordRestApi("unused-test-token", mock.rest);

    mock.get
      .mockResolvedValueOnce(BOT_USER)
      .mockResolvedValueOnce([TEST_PARTIAL_GUILD])
      .mockResolvedValueOnce(TEST_GUILD)
      .mockResolvedValueOnce([TEST_CHANNEL])
      .mockResolvedValueOnce({ threads: [TEST_CHANNEL] })
      .mockResolvedValueOnce(TEST_CHANNEL)
      .mockResolvedValueOnce(TEST_MESSAGE)
      .mockResolvedValueOnce([TEST_MESSAGE])
      .mockResolvedValueOnce([TEST_MESSAGE]);
    mock.del.mockResolvedValue(undefined);

    await expect(api.getCurrentUser()).resolves.toBe(BOT_USER);
    await expect(
      api.listCurrentUserGuilds({
        limit: 10,
        before: GUILD_ID,
        after: "123456789012345679",
      }),
    ).resolves.toEqual([TEST_PARTIAL_GUILD]);
    await expect(api.getGuild(GUILD_ID)).resolves.toBe(TEST_GUILD);
    await expect(api.listGuildChannels(GUILD_ID)).resolves.toEqual([
      TEST_CHANNEL,
    ]);
    await expect(api.listGuildActiveThreads(GUILD_ID)).resolves.toEqual([
      TEST_CHANNEL,
    ]);
    await expect(api.getChannel(CHANNEL_ID)).resolves.toBe(TEST_CHANNEL);
    await expect(api.getMessage(CHANNEL_ID, MESSAGE_ID)).resolves.toBe(
      TEST_MESSAGE,
    );
    await expect(
      api.listMessages(CHANNEL_ID, {
        limit: 10,
        after: MESSAGE_ID,
      }),
    ).resolves.toEqual([TEST_MESSAGE]);
    await expect(
      api.listMessages(CHANNEL_ID, {
        limit: 10,
        around: MESSAGE_ID,
      }),
    ).resolves.toEqual([TEST_MESSAGE]);
    await expect(api.deleteMessage(CHANNEL_ID, MESSAGE_ID)).resolves.toBe(
      undefined,
    );

    const guildQuery = mock.get.mock.calls[1]?.[1] as {
      query: URLSearchParams;
    };
    expect(guildQuery.query.get("before")).toBe(GUILD_ID);
    expect(guildQuery.query.get("after")).toBe("123456789012345679");
    expect(mock.get).toHaveBeenCalledTimes(9);
    expect(mock.del).toHaveBeenCalledOnce();
  });

  it("suppresses mentions and adds an enforced nonce when sending", async () => {
    const mock = makeRestMock();
    mock.post.mockResolvedValue(TEST_MESSAGE);
    const api = new DiscordRestApi("unused-test-token", mock.rest);

    await api.createMessage(CHANNEL_ID, {
      content: "hello @everyone <@123456789012345678>",
      replyToMessageId: MESSAGE_ID,
    });

    const request = mock.post.mock.calls[0]?.[1] as {
      body: Record<string, unknown>;
    };
    expect(request.body.allowed_mentions).toEqual({
      parse: [],
      replied_user: false,
    });
    expect(request.body.enforce_nonce).toBe(true);
    expect(request.body.nonce).toMatch(/^[a-f0-9]{24}$/);
    expect(request.body.message_reference).toEqual({
      message_id: MESSAGE_ID,
      fail_if_not_exists: true,
    });
  });

  it("omits a message reference for a standalone message", async () => {
    const mock = makeRestMock();
    mock.post.mockResolvedValue(TEST_MESSAGE);
    const api = new DiscordRestApi("unused-test-token", mock.rest);

    await api.createMessage(CHANNEL_ID, { content: "standalone" });

    const request = mock.post.mock.calls[0]?.[1] as {
      body: Record<string, unknown>;
    };
    expect(request.body).not.toHaveProperty("message_reference");
  });

  it("suppresses mentions when editing", async () => {
    const mock = makeRestMock();
    mock.patch.mockResolvedValue(TEST_MESSAGE);
    const api = new DiscordRestApi("unused-test-token", mock.rest);

    await api.editMessage(CHANNEL_ID, MESSAGE_ID, "edited");

    const request = mock.patch.mock.calls[0]?.[1] as {
      body: Record<string, unknown>;
    };
    expect(request.body).toMatchObject({
      content: "edited",
      allowed_mentions: { parse: [], replied_user: false },
    });
  });

  it("builds a bounded message pagination query", async () => {
    const mock = makeRestMock();
    mock.get.mockResolvedValue([TEST_MESSAGE]);
    const api = new DiscordRestApi("unused-test-token", mock.rest);

    await api.listMessages(CHANNEL_ID, { limit: 20, before: MESSAGE_ID });

    const request = mock.get.mock.calls[0]?.[1] as { query: URLSearchParams };
    expect(request.query.get("limit")).toBe("20");
    expect(request.query.get("before")).toBe(MESSAGE_ID);
    expect(request.query.has("after")).toBe(false);
  });

  it("passes cancellation signals into the REST queue", async () => {
    const mock = makeRestMock();
    mock.get.mockResolvedValue([TEST_MESSAGE]);
    const api = new DiscordRestApi("unused-test-token", mock.rest);
    const controller = new AbortController();

    await api.listMessages(
      CHANNEL_ID,
      { limit: 20 },
      controller.signal,
    );

    const request = mock.get.mock.calls[0]?.[1] as {
      signal: AbortSignal;
    };
    expect(request.signal).toBe(controller.signal);
  });

  it("preserves abort errors and translates other REST failures", async () => {
    const mock = makeRestMock();
    const api = new DiscordRestApi("unused-test-token", mock.rest);
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    mock.get.mockRejectedValueOnce(abortError);

    await expect(api.getCurrentUser()).rejects.toBe(abortError);

    mock.get.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(api.getCurrentUser()).rejects.toThrow(
      "Could not reach the Discord API",
    );
  });
});
