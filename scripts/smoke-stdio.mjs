import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/smoke-stdio.mjs <command> [args ...]");
  process.exit(2);
}

const child = spawn(command, args, {
  env: {
    ...process.env,
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || "smoke-test-token",
    DISCORD_ENABLE_WRITES: "false",
    DISCORD_ENABLE_DELETES: "false",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let settled = false;
let toolCount = 0;
let resourceCount = 0;

const timeout = setTimeout(() => {
  finish(new Error(`MCP smoke test timed out. stderr: ${stderr}`));
}, 10_000);

function finish(error) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  child.kill("SIGTERM");
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

child.once("error", finish);
child.once("exit", (code, signal) => {
  if (!settled) {
    finish(
      new Error(
        `MCP server exited before completing the smoke test (${signal ?? `code ${String(code)}`}). stderr: ${stderr}`,
      ),
    );
  }
});
child.stdin.on("error", (error) => {
  if (!settled) finish(error);
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
  const lines = stdout.split("\n");
  stdout = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;

    let response;
    try {
      response = JSON.parse(line);
    } catch {
      finish(new Error(`Server wrote non-JSON data to stdout: ${line}`));
      return;
    }

    if (response.id === 1) {
      if (!response.result?.serverInfo) {
        finish(new Error(`Invalid initialize response: ${line}`));
        return;
      }
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    } else if (response.id === 2) {
      const count = response.result?.tools?.length;
      if (!Number.isInteger(count) || count < 1) {
        finish(new Error(`Invalid tools/list response: ${line}`));
        return;
      }
      toolCount = count;
      send({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} });
    } else if (response.id === 3) {
      const count = response.result?.resources?.length;
      if (!Number.isInteger(count) || count < 1) {
        finish(new Error(`Invalid resources/list response: ${line}`));
        return;
      }
      resourceCount = count;
      send({
        jsonrpc: "2.0",
        id: 4,
        method: "resources/templates/list",
        params: {},
      });
    } else if (response.id === 4) {
      const templateCount = response.result?.resourceTemplates?.length;
      if (!Number.isInteger(templateCount) || templateCount < 1) {
        finish(new Error(`Invalid resources/templates/list response: ${line}`));
        return;
      }
      console.log(
        `MCP stdio smoke passed: ${toolCount} tools, ${resourceCount} resources, ${templateCount} templates (${command} ${args.join(" ")})`,
      );
      finish();
    }
  }
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "discord-mcp-smoke", version: "1.0.0" },
  },
});
