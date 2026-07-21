#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config as loadDotenv } from "dotenv";

import { loadConfig } from "./config.js";
import { DiscordRestApi } from "./discord-api.js";
import { createDiscordMcpServer } from "./server.js";
import { VERSION } from "./version.js";

const HELP = `discord-mcp ${VERSION}

Usage: discord-mcp [--help] [--version]

Runs the Discord MCP server over stdio. Configuration is supplied through
DISCORD_TOKEN and the DISCORD_* environment variables documented in README.md.`;

function handleCliFlags(args: readonly string[]): boolean {
  if (args.includes("--version") || args.includes("-V")) {
    console.log(VERSION);
    return true;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return true;
  }

  if (args.length > 0) {
    throw new Error(`Unknown argument: ${args[0]}. Use --help for usage.`);
  }

  return false;
}

loadDotenv({ quiet: true });

async function main(): Promise<void> {
  if (handleCliFlags(process.argv.slice(2))) return;

  const config = loadConfig();
  const api = new DiscordRestApi(config.token);
  const server = createDiscordMcpServer({ config, api });
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await server.close();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  await server.connect(transport);
  console.error(
    `discord-mcp ${VERSION} running on stdio (writes=${config.writesEnabled}, deletes=${config.deletesEnabled})`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`discord-mcp failed to start: ${message}`);
  process.exitCode = 1;
});
