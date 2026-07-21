import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";

import { createDiscordMcpServer } from "../src/server.js";
import {
  CHANNEL_ID,
  GUILD_ID,
  MESSAGE_ID,
  OTHER_CHANNEL_ID,
  OTHER_USER,
  TEST_CHANNEL,
  TEST_MESSAGE,
  TEST_PARTIAL_GUILD,
  makeConfig,
  makeMockApi,
  type MockDiscordApi,
} from "./fixtures.js";

interface Harness {
  readonly server: McpServer;
  readonly client: Client;
  readonly api: MockDiscordApi;
}

const harnesses: Harness[] = [];

async function createHarness(
  config = makeConfig(),
  api = makeMockApi(),
): Promise<Harness> {
  const server = createDiscordMcpServer({ config, api });
  const client = new Client({ name: "discord-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const harness = { server, client, api };
  harnesses.push(harness);
  return harness;
}

afterEach(async () => {
  await Promise.all(
    harnesses.splice(0).map(async ({ client, server }) => {
      await client.close();
      await server.close();
    }),
  );
});

describe("Discord MCP server", () => {
  it("rejects an unsafe directly constructed configuration", () => {
    expect(() =>
      createDiscordMcpServer({
        config: makeConfig({ deletesEnabled: true }),
        api: makeMockApi(),
      }),
    ).toThrow("requires DISCORD_ENABLE_WRITES=true");
  });

  it("initializes and exposes read-only tools by default", async () => {
    const { client } = await createHarness();
    const names = (await client.listTools()).tools.map((tool) => tool.name);

    expect(names).toContain("discord_get_messages");
    expect(names).not.toContain("discord_send_message");
    expect(names).not.toContain("discord_delete_own_message");
  });

  it("serves bot, guild, channel, and message read tools", async () => {
    const { client, api } = await createHarness();

    const firstBot = await client.callTool({ name: "discord_get_bot" });
    const secondBot = await client.callTool({ name: "discord_get_bot" });
    const guilds = await client.callTool({
      name: "discord_list_guilds",
      arguments: { limit: 1, before: GUILD_ID },
    });
    const guild = await client.callTool({
      name: "discord_get_guild",
      arguments: { guild_id: GUILD_ID },
    });
    const channel = await client.callTool({
      name: "discord_get_channel",
      arguments: { channel_id: CHANNEL_ID },
    });
    const message = await client.callTool({
      name: "discord_get_message",
      arguments: { channel_id: CHANNEL_ID, message_id: MESSAGE_ID },
    });

    expect(firstBot.structuredContent).toHaveProperty("bot");
    expect(secondBot.isError).not.toBe(true);
    expect(api.getCurrentUser).toHaveBeenCalledOnce();
    expect(guilds.structuredContent).toMatchObject({
      count: 1,
      allowlist_active: false,
      page: { more_may_exist: true },
    });
    expect(guild.structuredContent).toHaveProperty("guild");
    expect(channel.structuredContent).toHaveProperty("channel");
    expect(message.structuredContent).toMatchObject({
      untrusted_external_data: true,
    });
  });

  it("validates mutually exclusive guild cursors", async () => {
    const { client, api } = await createHarness();
    const result = await client.callTool({
      name: "discord_list_guilds",
      arguments: {
        before: GUILD_ID,
        after: "123456789012345679",
      },
    });

    expect(result.isError).toBe(true);
    expect(api.listCurrentUserGuilds).not.toHaveBeenCalled();
  });

  it("describes an empty guild page with null source cursors", async () => {
    const api = makeMockApi();
    api.listCurrentUserGuilds.mockResolvedValue([]);
    const { client } = await createHarness(makeConfig(), api);

    const result = await client.callTool({
      name: "discord_list_guilds",
      arguments: { limit: 10 },
    });

    expect(result.structuredContent).toMatchObject({
      count: 0,
      page: {
        first_source_guild_id: null,
        last_source_guild_id: null,
        more_may_exist: false,
      },
    });
  });

  it("exposes write and delete tools only under their feature flags", async () => {
    const { client } = await createHarness(
      makeConfig({
        writesEnabled: true,
        deletesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
    );
    const names = (await client.listTools()).tools.map((tool) => tool.name);

    expect(names).toContain("discord_send_message");
    expect(names).toContain("discord_edit_own_message");
    expect(names).toContain("discord_delete_own_message");
  });

  it("validates mutually exclusive message cursors before calling Discord", async () => {
    const { client, api } = await createHarness();
    const result = await client.callTool({
      name: "discord_get_messages",
      arguments: {
        channel_id: CHANNEL_ID,
        before: MESSAGE_ID,
        after: "323456789012345679",
      },
    });

    expect(result.isError).toBe(true);
    expect(api.getChannel).not.toHaveBeenCalled();
    expect(api.listMessages).not.toHaveBeenCalled();
  });

  it("reads messages through an allowlisted channel", async () => {
    const { client, api } = await createHarness();
    const result = await client.callTool({
      name: "discord_get_messages",
      arguments: { channel_id: CHANNEL_ID, limit: 10 },
    });

    expect(result.isError).not.toBe(true);
    expect(api.getChannel).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.any(AbortSignal),
    );
    expect(api.listMessages).toHaveBeenCalledWith(
      CHANNEL_ID,
      {
        limit: 10,
        before: undefined,
        after: undefined,
        around: undefined,
      },
      expect.any(AbortSignal),
    );
    expect(result.structuredContent).toMatchObject({
      channel_id: CHANNEL_ID,
      count: 1,
      untrusted_external_data: true,
    });
  });

  it("rejects container channels before requesting messages", async () => {
    const api = makeMockApi();
    api.getChannel.mockResolvedValue({
      ...TEST_CHANNEL,
      type: 4,
    } as never);
    const { client } = await createHarness(
      makeConfig({ allowedChannelIds: new Set([CHANNEL_ID]) }),
      api,
    );

    const result = await client.callTool({
      name: "discord_get_messages",
      arguments: { channel_id: CHANNEL_ID },
    });

    expect(result.isError).toBe(true);
    expect(api.listMessages).not.toHaveBeenCalled();
  });

  it("rejects malformed channel payloads before requesting messages", async () => {
    const api = makeMockApi();
    api.getChannel.mockResolvedValue({
      ...TEST_CHANNEL,
      type: "not-a-number",
    } as never);
    const { client } = await createHarness(makeConfig(), api);

    const result = await client.callTool({
      name: "discord_get_messages",
      arguments: { channel_id: CHANNEL_ID },
    });

    expect(result.isError).toBe(true);
    expect(api.listMessages).not.toHaveBeenCalled();
  });

  it("merges active threads into the channel directory", async () => {
    const api = makeMockApi();
    api.listGuildActiveThreads.mockResolvedValue([
      {
        ...TEST_CHANNEL,
        id: OTHER_CHANNEL_ID,
        type: 11,
        name: "active-thread",
      } as never,
    ]);
    const { client } = await createHarness(
      makeConfig({ allowedGuildIds: new Set([GUILD_ID]) }),
      api,
    );

    const result = await client.callTool({
      name: "discord_list_channels",
      arguments: { guild_id: GUILD_ID },
    });

    expect(result.structuredContent).toMatchObject({ count: 2 });
    expect(api.listGuildActiveThreads).toHaveBeenCalled();
  });

  it("blocks a channel allowlist miss before a Discord request", async () => {
    const { client, api } = await createHarness(
      makeConfig({ allowedChannelIds: new Set([OTHER_CHANNEL_ID]) }),
    );
    const result = await client.callTool({
      name: "discord_get_message",
      arguments: { channel_id: CHANNEL_ID, message_id: MESSAGE_ID },
    });

    expect(result.isError).toBe(true);
    expect(api.getChannel).not.toHaveBeenCalled();
    expect(api.getMessage).not.toHaveBeenCalled();
  });

  it("sends messages when write mode is enabled", async () => {
    const { client, api } = await createHarness(
      makeConfig({
        writesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
    );
    const result = await client.callTool({
      name: "discord_send_message",
      arguments: {
        channel_id: CHANNEL_ID,
        content: "hello",
        reply_to_message_id: MESSAGE_ID,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(api.createMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      { content: "hello", replyToMessageId: MESSAGE_ID },
      expect.any(AbortSignal),
    );
  });

  it("refuses to edit a message owned by another user", async () => {
    const api = makeMockApi();
    api.getMessage.mockResolvedValue({
      ...TEST_MESSAGE,
      author: OTHER_USER,
    });
    const { client } = await createHarness(
      makeConfig({
        writesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
      api,
    );
    const result = await client.callTool({
      name: "discord_edit_own_message",
      arguments: {
        channel_id: CHANNEL_ID,
        message_id: MESSAGE_ID,
        content: "should not be written",
      },
    });

    expect(result.isError).toBe(true);
    expect(api.editMessage).not.toHaveBeenCalled();
  });

  it("refuses webhook-authored messages even when the bot ID matches", async () => {
    const api = makeMockApi();
    api.getMessage.mockResolvedValue({
      ...TEST_MESSAGE,
      webhook_id: "623456789012345678",
    });
    const { client } = await createHarness(
      makeConfig({
        writesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
      api,
    );

    const result = await client.callTool({
      name: "discord_edit_own_message",
      arguments: {
        channel_id: CHANNEL_ID,
        message_id: MESSAGE_ID,
        content: "should not be written",
      },
    });

    expect(result.isError).toBe(true);
    expect(api.editMessage).not.toHaveBeenCalled();
  });

  it("edits a message authored directly by the bot", async () => {
    const { client, api } = await createHarness(
      makeConfig({
        writesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
    );

    const result = await client.callTool({
      name: "discord_edit_own_message",
      arguments: {
        channel_id: CHANNEL_ID,
        message_id: MESSAGE_ID,
        content: "edited",
      },
    });

    expect(result.structuredContent).toMatchObject({ edited: true });
    expect(api.editMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      MESSAGE_ID,
      "edited",
      expect.any(AbortSignal),
    );
  });

  it("requires literal confirmation before deletion", async () => {
    const { client, api } = await createHarness(
      makeConfig({
        writesEnabled: true,
        deletesEnabled: true,
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
    );

    const rejected = await client.callTool({
      name: "discord_delete_own_message",
      arguments: {
        channel_id: CHANNEL_ID,
        message_id: MESSAGE_ID,
        confirm: false,
      },
    });
    expect(rejected.isError).toBe(true);
    expect(api.deleteMessage).not.toHaveBeenCalled();

    const accepted = await client.callTool({
      name: "discord_delete_own_message",
      arguments: {
        channel_id: CHANNEL_ID,
        message_id: MESSAGE_ID,
        confirm: true,
      },
    });
    expect(accepted.isError).not.toBe(true);
    expect(api.deleteMessage).toHaveBeenCalledWith(
      CHANNEL_ID,
      MESSAGE_ID,
      expect.any(AbortSignal),
    );
  });

  it("lists and reads Discord resources", async () => {
    const { client } = await createHarness();
    const resources = await client.listResources();
    const templates = await client.listResourceTemplates();

    expect(resources.resources.map((resource) => resource.uri)).toEqual([
      "discord://bot",
      "discord://guilds",
    ]);
    expect(templates.resourceTemplates.map((template) => template.uriTemplate))
      .toContain("discord://channels/{channel_id}/messages/{message_id}");

    const result = await client.readResource({ uri: "discord://bot" });
    expect(result.contents[0]?.mimeType).toBe("application/json");
    expect(result.contents[0]).toMatchObject({ uri: "discord://bot" });
  });

  it("reads every Discord resource template", async () => {
    const { client, api } = await createHarness();
    api.listCurrentUserGuilds.mockResolvedValue(
      Array.from({ length: 200 }, () => TEST_PARTIAL_GUILD),
    );

    const guilds = await client.readResource({ uri: "discord://guilds" });
    api.listCurrentUserGuilds.mockResolvedValue([TEST_PARTIAL_GUILD]);
    const guild = await client.readResource({
      uri: `discord://guilds/${GUILD_ID}`,
    });
    const channels = await client.readResource({
      uri: `discord://guilds/${GUILD_ID}/channels`,
    });
    const channel = await client.readResource({
      uri: `discord://channels/${CHANNEL_ID}`,
    });
    const message = await client.readResource({
      uri: `discord://channels/${CHANNEL_ID}/messages/${MESSAGE_ID}`,
    });

    const text = (result: typeof guilds): string => {
      const content = result.contents[0];
      return content && "text" in content ? content.text : "";
    };
    expect(text(guilds)).toContain('"more_may_exist": true');
    expect(text(guild)).toContain('"guild"');
    expect(text(channels)).toContain('"channels"');
    expect(text(channel)).toContain('"channel"');
    expect(text(message)).toContain('"untrusted_external_data": true');
  });

  it("preserves invalid-parameter and unexpected resource errors", async () => {
    const { client, api } = await createHarness();

    await expect(
      client.readResource({ uri: "discord://guilds/not-a-snowflake" }),
    ).rejects.toMatchObject({ code: -32_602 });

    const unexpected = new Error("unexpected test failure");
    api.getGuild.mockRejectedValueOnce(unexpected);
    await expect(
      client.readResource({ uri: `discord://guilds/${GUILD_ID}` }),
    ).rejects.toMatchObject({ code: -32_603 });
  });

  it("returns a resource-not-found code for an out-of-scope resource", async () => {
    const { client, api } = await createHarness(
      makeConfig({ allowedChannelIds: new Set([OTHER_CHANNEL_ID]) }),
    );

    await expect(
      client.readResource({ uri: `discord://channels/${CHANNEL_ID}` }),
    ).rejects.toMatchObject({ code: -32_002 });
    expect(api.getChannel).not.toHaveBeenCalled();
  });
});
