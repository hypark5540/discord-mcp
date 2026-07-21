import { describe, expect, it } from "vitest";

import { fitStructuredResult, toolResult } from "../src/response.js";

describe("fitStructuredResult", () => {
  it("keeps small responses unchanged", () => {
    const data = { messages: [{ content: "small" }] };
    expect(fitStructuredResult(data, 1_000)).toBe(data);
  });

  it("trims top-level arrays to the configured response budget", () => {
    const data = {
      messages: Array.from({ length: 20 }, (_, index) => ({
        id: index,
        content: "x".repeat(200),
      })),
    };

    const fitted = fitStructuredResult(data, 1_000);
    expect(fitted.truncated).toBe(true);
    expect(fitted.total_count).toBe(20);
    expect((fitted.messages as unknown[]).length).toBeLessThan(20);
    expect(JSON.stringify(fitted, null, 2).length).toBeLessThanOrEqual(1_000);
  });

  it("falls back to a bounded preview for a single oversized value", () => {
    const fitted = fitStructuredResult(
      { value: '\\\"'.repeat(4_000) },
      1_000,
    );
    expect(fitted.truncated).toBe(true);
    expect(fitted.preview).toBeTypeOf("string");
    expect(JSON.stringify(fitted, null, 2).length).toBeLessThanOrEqual(1_000);
  });

  it("uses a preview when even empty array metadata exceeds the budget", () => {
    const fitted = fitStructuredResult(
      { messages: [{ content: "x".repeat(500) }] },
      75,
    );

    expect(fitted.truncated).toBe(true);
    expect(fitted).not.toHaveProperty("messages");
    expect(fitted.preview).toBeTypeOf("string");
    expect(JSON.stringify(fitted, null, 2).length).toBeLessThanOrEqual(75);
  });

  it("keeps the serialized tool result within the total response budget", () => {
    const result = toolResult(
      {
        messages: Array.from({ length: 100 }, (_, index) => ({
          index,
          content: "x".repeat(500),
        })),
      },
      1_000,
    );

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1_000);
  });
});
