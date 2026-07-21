import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

type StructuredResult = Record<string, unknown>;

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function fitStructuredResult(
  data: StructuredResult,
  maxChars: number,
): StructuredResult {
  const original = stringify(data);
  if (original.length <= maxChars) {
    return data;
  }

  const arrayEntry = Object.entries(data).find(([, value]) =>
    Array.isArray(value),
  );
  if (arrayEntry !== undefined) {
    const [key, value] = arrayEntry as [string, unknown[]];
    let low = 0;
    let high = value.length;
    let best: StructuredResult | undefined;

    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      const candidate: StructuredResult = {
        ...data,
        [key]: value.slice(0, midpoint),
        truncated: true,
        total_count: value.length,
        returned_count: midpoint,
      };
      if (stringify(candidate).length <= maxChars) {
        best = candidate;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }

    if (best !== undefined) {
      return best;
    }
  }

  let low = 0;
  let high = original.length;
  let best: StructuredResult = {
    truncated: true,
    original_char_count: original.length,
    preview: "",
  };

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const candidate: StructuredResult = {
      truncated: true,
      original_char_count: original.length,
      preview: original.slice(0, midpoint),
    };
    if (stringify(candidate).length <= maxChars) {
      best = candidate;
      low = midpoint + 1;
    } else {
      high = midpoint - 1;
    }
  }

  return best;
}

export function toolResult(
  data: StructuredResult,
  maxChars: number,
): CallToolResult {
  return fitEnvelope(data, maxChars, (fitted) => ({
    content: [{ type: "text", text: stringify(fitted) }],
    structuredContent: fitted,
  }));
}

export function resourceResult(
  uri: URL | string,
  data: StructuredResult,
  maxChars: number,
): ReadResourceResult {
  return fitEnvelope(data, maxChars, (fitted) => ({
    contents: [
      {
        uri: String(uri),
        mimeType: "application/json",
        text: stringify(fitted),
      },
    ],
  }));
}

function fitEnvelope<T>(
  data: StructuredResult,
  maxChars: number,
  build: (fitted: StructuredResult) => T,
): T {
  let low = 0;
  let high = maxChars;
  let best = build({ truncated: true, preview: "" });

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const candidate = build(fitStructuredResult(data, midpoint));
    if (JSON.stringify(candidate).length <= maxChars) {
      best = candidate;
      low = midpoint + 1;
    } else {
      high = midpoint - 1;
    }
  }

  return best;
}
