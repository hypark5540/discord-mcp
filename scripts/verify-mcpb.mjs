import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const artifact = resolve(
  root,
  process.argv[2] ??
    `release-artifacts/mcpb/discord-mcp-${packageJson.version}.mcpb`,
);
const expectedEntries = new Map([
  ["LICENSE", "LICENSE"],
  ["manifest.json", "mcpb/manifest.json"],
  ["server/THIRD_PARTY_NOTICES.txt", "bundle/THIRD_PARTY_NOTICES.txt"],
  ["server/discord-mcp.cjs", "bundle/discord-mcp.cjs"],
  ["server/sbom.cdx.json", "bundle/sbom.cdx.json"],
]);

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed (${signal ?? `code ${String(code)}`}).`,
        ),
      );
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function assertArchiveContents(contents) {
  const unpacked = unzipSync(contents);
  const actualPaths = Object.keys(unpacked).sort();
  const expectedPaths = [...expectedEntries.keys()].sort();
  assert(
    actualPaths.length === expectedPaths.length &&
      actualPaths.every((entry, index) => entry === expectedPaths[index]),
    `Unexpected MCPB entries: ${actualPaths.join(", ")}.`,
  );

  for (const [archivePath, sourcePath] of expectedEntries) {
    const source = await readFile(resolve(root, sourcePath));
    assert(
      Buffer.from(unpacked[archivePath]).equals(source),
      `${archivePath} does not match ${sourcePath}.`,
    );
  }

  const manifest = JSON.parse(
    Buffer.from(unpacked["manifest.json"]).toString("utf8"),
  );
  const tokenConfig = manifest.user_config?.discord_token;
  assert(manifest.manifest_version === "0.3", "MCPB must use manifest v0.3.");
  assert(
    manifest.version === packageJson.version,
    "MCPB version must match package.json.",
  );
  assert(
    manifest.server?.entry_point === "server/discord-mcp.cjs",
    "MCPB entry point must use the shared server bundle.",
  );
  assert(
    tokenConfig?.type === "string" &&
      tokenConfig.required === true &&
      tokenConfig.sensitive === true &&
      tokenConfig.default === undefined,
    "Discord token must be a required sensitive user_config value without a default.",
  );
  assert(
    manifest.server?.mcp_config?.env?.DISCORD_TOKEN ===
      "${user_config.discord_token}",
    "DISCORD_TOKEN must come only from sensitive user_config.",
  );
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "discord-mcp-verify-mcpb-"));
const firstBuild = resolve(temporaryRoot, "first.mcpb");
const secondBuild = resolve(temporaryRoot, "second.mcpb");
const unpackDirectory = resolve(temporaryRoot, "unpacked");
const buildScript = resolve(root, "scripts/build-mcpb.mjs");
const smokeScript = resolve(root, "scripts/smoke-stdio.mjs");
const mcpbCli = resolve(
  root,
  "node_modules/@anthropic-ai/mcpb/dist/cli/cli.js",
);

try {
  await run(process.execPath, [buildScript, "--output", firstBuild]);
  await run(process.execPath, [buildScript, "--output", secondBuild]);

  const [publishedContents, firstContents, secondContents] = await Promise.all([
    readFile(artifact),
    readFile(firstBuild),
    readFile(secondBuild),
  ]);
  assert(
    firstContents.equals(secondContents),
    `MCPB builds are not deterministic: ${sha256(firstContents)} != ${sha256(secondContents)}.`,
  );
  assert(
    publishedContents.equals(firstContents),
    `MCPB artifact is stale: ${sha256(publishedContents)} != ${sha256(firstContents)}.`,
  );
  await assertArchiveContents(publishedContents);

  await run(process.execPath, [
    mcpbCli,
    "unpack",
    artifact,
    unpackDirectory,
  ]);
  await run(process.execPath, [
    mcpbCli,
    "validate",
    resolve(unpackDirectory, "manifest.json"),
  ]);
  await run(process.execPath, [
    smokeScript,
    process.execPath,
    resolve(unpackDirectory, "server/discord-mcp.cjs"),
  ]);

  console.log(
    `MCPB verification passed: deterministic sha256 ${sha256(publishedContents)}`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
