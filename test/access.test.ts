import { describe, expect, it } from "vitest";

import { AccessController } from "../src/access.js";
import {
  CHANNEL_ID,
  GUILD_ID,
  OTHER_CHANNEL_ID,
  OTHER_GUILD_ID,
  TEST_CHANNEL,
  makeConfig,
  makeMockApi,
} from "./fixtures.js";

describe("AccessController", () => {
  it("allows guild channels when no allowlist is configured", async () => {
    const api = makeMockApi();
    const access = new AccessController(makeConfig(), api);

    await expect(access.assertChannelAllowed(CHANNEL_ID)).resolves.toMatchObject({
      id: CHANNEL_ID,
    });
  });

  it("blocks a channel before making a Discord request", async () => {
    const api = makeMockApi();
    const access = new AccessController(
      makeConfig({ allowedChannelIds: new Set([OTHER_CHANNEL_ID]) }),
      api,
    );

    await expect(access.assertChannelAllowed(CHANNEL_ID)).rejects.toThrow(
      "DISCORD_ALLOWED_CHANNEL_IDS",
    );
    expect(api.getChannel).not.toHaveBeenCalled();
  });

  it("applies guild and channel allowlists as an intersection", async () => {
    const api = makeMockApi();
    const access = new AccessController(
      makeConfig({
        allowedGuildIds: new Set([OTHER_GUILD_ID]),
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
      api,
    );

    await expect(access.assertChannelAllowed(CHANNEL_ID)).rejects.toThrow(
      "DISCORD_ALLOWED_GUILD_IDS",
    );
  });

  it("rejects direct-message channels without a guild ID", async () => {
    const api = makeMockApi();
    api.getChannel.mockResolvedValue({
      ...TEST_CHANNEL,
      guild_id: undefined,
    } as never);
    const access = new AccessController(makeConfig(), api);

    await expect(access.assertChannelAllowed(CHANNEL_ID)).rejects.toThrow(
      "Direct-message and group-DM channels",
    );
  });

  it("filters list results", () => {
    const api = makeMockApi();
    const access = new AccessController(
      makeConfig({
        allowedGuildIds: new Set([GUILD_ID]),
        allowedChannelIds: new Set([CHANNEL_ID]),
      }),
      api,
    );

    expect(
      access.filterGuilds([{ id: GUILD_ID }, { id: OTHER_GUILD_ID }]),
    ).toEqual([{ id: GUILD_ID }]);
    expect(
      access.filterChannels([{ id: CHANNEL_ID }, { id: OTHER_CHANNEL_ID }]),
    ).toEqual([{ id: CHANNEL_ID }]);
  });
});
