import {
  DiscordAPIError,
  HTTPError,
  RateLimitError,
} from "@discordjs/rest";
import { describe, expect, it } from "vitest";

import { DiscordMcpError, translateDiscordError } from "../src/errors.js";

const requestBody = { body: null, files: undefined };

function httpError(status: number): HTTPError {
  return new HTTPError(
    status,
    "test status",
    "GET",
    "https://discord.test/resource",
    requestBody,
  );
}

describe("translateDiscordError", () => {
  it("maps rate limits", () => {
    const error = new RateLimitError({
      timeToReset: 1,
      limit: 1,
      method: "GET",
      hash: "hash",
      url: "https://discord.test/resource",
      route: "/resource",
      majorParameter: "global",
      global: false,
      retryAfter: 1,
      sublimitTimeout: 0,
      scope: "user",
    });

    expect(translateDiscordError(error).message).toContain("rate limit");
  });

  it.each([
    [400, "invalid"],
    [401, "bot token"],
    [403, "permission"],
    [404, "not found"],
    [429, "rate limit"],
    [503, "HTTP 503"],
  ])("maps HTTP %i failures", (status, expected) => {
    expect(translateDiscordError(httpError(status)).message).toContain(
      expected,
    );
  });

  it("maps Discord API errors through the same status table", () => {
    const error = new DiscordAPIError(
      { message: "bad request", code: 50_035 },
      50_035,
      400,
      "POST",
      "https://discord.test/resource",
      requestBody,
    );
    expect(translateDiscordError(error).message).toContain("invalid");
  });

  it("maps network failures, preserves known errors, and hides unknowns", () => {
    expect(translateDiscordError(new TypeError("offline")).message).toContain(
      "network connection",
    );

    const known = new DiscordMcpError("already safe");
    expect(translateDiscordError(known)).toBe(known);
    expect(translateDiscordError({ private: "detail" }).message).toBe(
      "An unexpected Discord API error occurred.",
    );
  });
});
