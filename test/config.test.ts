import { describe, expect, it } from "vitest";

import { ConfigurationError, loadConfig } from "../src/config.js";
import { CHANNEL_ID, GUILD_ID } from "./fixtures.js";

describe("loadConfig", () => {
  it("uses safe defaults", () => {
    const config = loadConfig({ DISCORD_TOKEN: "token" });

    expect(config.writesEnabled).toBe(false);
    expect(config.deletesEnabled).toBe(false);
    expect(config.allowedGuildIds.size).toBe(0);
    expect(config.allowedChannelIds.size).toBe(0);
    expect(config.maxResponseChars).toBe(50_000);
  });

  it("parses feature flags and allowlists", () => {
    const config = loadConfig({
      DISCORD_TOKEN: "token",
      DISCORD_ENABLE_WRITES: "yes",
      DISCORD_ENABLE_DELETES: "1",
      DISCORD_ALLOW_UNRESTRICTED_WRITES: "false",
      DISCORD_ALLOWED_GUILD_IDS: `${GUILD_ID}, ${GUILD_ID}`,
      DISCORD_ALLOWED_CHANNEL_IDS: CHANNEL_ID,
      DISCORD_MAX_RESPONSE_CHARS: "1000",
    });

    expect(config.writesEnabled).toBe(true);
    expect(config.deletesEnabled).toBe(true);
    expect([...config.allowedGuildIds]).toEqual([GUILD_ID]);
    expect([...config.allowedChannelIds]).toEqual([CHANNEL_ID]);
    expect(config.maxResponseChars).toBe(1_000);
  });

  it("accepts DISCORD_BOT_TOKEN as a compatibility alias", () => {
    expect(loadConfig({ DISCORD_BOT_TOKEN: "alias-token" }).token).toBe(
      "alias-token",
    );
  });

  it("requires a token", () => {
    expect(() => loadConfig({})).toThrow(ConfigurationError);
  });

  it("rejects delete mode unless writes are enabled", () => {
    expect(() =>
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ENABLE_DELETES: "true",
      }),
    ).toThrow("requires DISCORD_ENABLE_WRITES=true");
  });

  it("requires a write allowlist unless unrestricted writes are explicit", () => {
    expect(() =>
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ENABLE_WRITES: "true",
      }),
    ).toThrow("Write mode requires DISCORD_ALLOWED_GUILD_IDS");

    const config = loadConfig({
      DISCORD_TOKEN: "token",
      DISCORD_ENABLE_WRITES: "true",
      DISCORD_ALLOW_UNRESTRICTED_WRITES: "true",
    });
    expect(config.unrestrictedWritesEnabled).toBe(true);
  });

  it("rejects invalid allowlist IDs", () => {
    expect(() =>
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ALLOWED_GUILD_IDS: "not-an-id",
      }),
    ).toThrow("invalid Discord snowflake");
  });

  it("accepts whitespace defaults and every documented boolean spelling", () => {
    for (const truthy of ["true", "1", "yes", "on", " TRUE "]) {
      expect(
        loadConfig({
          DISCORD_TOKEN: "token",
          DISCORD_ENABLE_WRITES: truthy,
          DISCORD_ALLOW_UNRESTRICTED_WRITES: "true",
        }).writesEnabled,
      ).toBe(true);
    }
    for (const falsy of ["false", "0", "no", "off", " OFF "]) {
      expect(
        loadConfig({
          DISCORD_TOKEN: "token",
          DISCORD_ENABLE_WRITES: falsy,
        }).writesEnabled,
      ).toBe(false);
    }

    const config = loadConfig({
      DISCORD_TOKEN: "token",
      DISCORD_ENABLE_WRITES: " ",
      DISCORD_ALLOWED_GUILD_IDS: " ",
      DISCORD_ALLOWED_CHANNEL_IDS: " , ",
      DISCORD_MAX_RESPONSE_CHARS: " ",
    });
    expect(config.writesEnabled).toBe(false);
    expect(config.allowedGuildIds.size).toBe(0);
    expect(config.allowedChannelIds.size).toBe(0);
    expect(config.maxResponseChars).toBe(50_000);
  });

  it("rejects malformed booleans, tokens, and response limits", () => {
    expect(() =>
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ENABLE_WRITES: "sometimes",
      }),
    ).toThrow("must be true or false");
    expect(() => loadConfig({ DISCORD_TOKEN: "   " })).toThrow(
      "DISCORD_TOKEN is required",
    );
    expect(() => loadConfig({ DISCORD_TOKEN: "two words" })).toThrow(
      "must not contain whitespace",
    );

    for (const value of ["1.5", "999", "200001"]) {
      expect(() =>
        loadConfig({
          DISCORD_TOKEN: "token",
          DISCORD_MAX_RESPONSE_CHARS: value,
        }),
      ).toThrow("must be an integer between 1000 and 200000");
    }
  });

  it("accepts either guild or channel scoping for write mode", () => {
    expect(
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ENABLE_WRITES: "true",
        DISCORD_ALLOWED_GUILD_IDS: GUILD_ID,
      }).writesEnabled,
    ).toBe(true);
    expect(
      loadConfig({
        DISCORD_TOKEN: "token",
        DISCORD_ENABLE_WRITES: "true",
        DISCORD_ALLOWED_CHANNEL_IDS: CHANNEL_ID,
      }).writesEnabled,
    ).toBe(true);
  });
});
