import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function capture(contents, pattern, label) {
  const match = contents.match(pattern);
  if (!match?.[1]) throw new Error(`Could not read version from ${label}.`);
  return match[1];
}

const packageJson = JSON.parse(await read("package.json"));
const packageLock = JSON.parse(await read("package-lock.json"));
const pyproject = await read("pyproject.toml");
const pythonInit = await read("python/src/hypark_discord_mcp/__init__.py");
const readme = await read("README.md");
const releaseGuide = await read("docs/releasing.md");
const clientGuide = await read("docs/clients.md");
const aiInstallGuide = await read("docs/ai-install.md");
const dockerfile = await read("Dockerfile");
const mcpExample = JSON.parse(await read("mcp.example.json"));
const sourceVersion = await read("src/version.ts");
const serverJson = JSON.parse(await read("server.json"));
const geminiExtension = JSON.parse(await read("gemini-extension.json"));
const mcpbManifest = JSON.parse(await read("mcpb/manifest.json"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pythonProjectName = capture(
  pyproject,
  /^name\s*=\s*"([^"]+)"/m,
  "PyPI project name",
);
const packageByRegistry = new Map(
  serverJson.packages.map((entry) => [entry.registryType, entry]),
);
const npmPackage = packageByRegistry.get("npm");
const pypiPackage = packageByRegistry.get("pypi");
const ociPackage = packageByRegistry.get("oci");

assert(
  serverJson.packages.length === 3 && packageByRegistry.size === 3,
  "server.json must contain exactly one npm, PyPI, and OCI package.",
);
assert(
  packageJson.mcpName === serverJson.name,
  "package.json mcpName must match server.json name.",
);
assert(
  npmPackage?.identifier === packageJson.name,
  "The server.json npm identifier must match package.json name.",
);
assert(
  pypiPackage?.identifier === pythonProjectName,
  "The server.json PyPI identifier must match pyproject.toml name.",
);
assert(
  ociPackage?.identifier ===
    `ghcr.io/hypark5540/discord-mcp:${serverJson.version}`,
  "The server.json OCI identifier must use the versioned GHCR image.",
);
assert(
  serverJson.packages.every((entry) => entry.transport?.type === "stdio"),
  "Every package in server.json must use stdio transport.",
);
assert(
  readme.includes(`<!-- mcp-name: ${serverJson.name} -->`),
  "README.md is missing the MCP Registry ownership marker.",
);
assert(
  dockerfile.includes(
    `io.modelcontextprotocol.server.name="${serverJson.name}"`,
  ),
  "Dockerfile is missing the MCP Registry ownership label.",
);
assert(
  packageLock.name === packageJson.name &&
    packageLock.version === packageJson.version &&
    packageLock.packages?.[""]?.name === packageJson.name &&
    packageLock.packages?.[""]?.version === packageJson.version,
  "package-lock.json root name/version must match package.json.",
);
assert(
  packageJson.dependencies === undefined ||
    Object.keys(packageJson.dependencies).length === 0,
  "Published runtime dependencies must stay inside the shared bundle.",
);
assert(
  packageJson.bin?.["discord-mcp"] === "bundle/discord-mcp.cjs" &&
    packageJson.bin?.["hypark-discord-mcp"] === "bundle/discord-mcp.cjs",
  "Both npm commands must execute the shared bundle.",
);
assert(
  packageJson.devDependencies?.["@anthropic-ai/mcpb"] === "2.1.2" &&
    packageLock.packages?.["node_modules/@anthropic-ai/mcpb"]?.version ===
      "2.1.2",
  "The official MCPB CLI must stay exactly pinned to 2.1.2 in package and lock metadata.",
);
assert(
  packageJson.devDependencies?.fflate === "0.8.2" &&
    packageLock.packages?.["node_modules/fflate"]?.version === "0.8.2",
  "The deterministic ZIP implementation must stay exactly pinned to fflate 0.8.2.",
);
assert(
  packageJson.overrides?.["@hono/node-server"] === "2.0.11" &&
    packageLock.packages?.["node_modules/@hono/node-server"]?.version ===
      "2.0.11",
  "The MCP SDK's transitive Hono adapter must stay on the patched 2.0.11 release.",
);
assert(
  packageJson.overrides?.tmp === "0.2.7" &&
    packageLock.packages?.["node_modules/tmp"]?.version === "0.2.7",
  "The MCPB CLI's transitive tmp dependency must stay on the patched 0.2.7 release.",
);
assert(
  JSON.stringify(packageJson.allowScripts) ===
    JSON.stringify({
      "esbuild@0.28.1": true,
      fsevents: false,
    }),
  "Install scripts must remain limited to the reviewed esbuild release, with fsevents explicitly denied.",
);
assert(
  packageJson.scripts?.["deps:locked"] ===
    "npm ci --ignore-scripts && npm rebuild esbuild@0.28.1 --ignore-scripts=false",
  "Dependency installation must block every lifecycle script before rebuilding only the reviewed esbuild release.",
);
const lockedInstallScripts = Object.entries(packageLock.packages ?? {})
  .filter(([, metadata]) => metadata.hasInstallScript === true)
  .map(([path, metadata]) => `${path.replace(/^node_modules\//, "")}@${metadata.version}`)
  .sort();
assert(
  JSON.stringify(lockedInstallScripts) ===
    JSON.stringify(["esbuild@0.28.1", "fsevents@2.3.3"]),
  `The lockfile contains an unreviewed install script: ${lockedInstallScripts.join(", ")}`,
);
assert(
  mcpExample.mcpServers?.discord?.args?.includes(
    `${packageJson.name}@${packageJson.version}`,
  ),
  "mcp.example.json must pin the current npm package version.",
);

const geminiServer = geminiExtension.mcpServers?.discord;
const geminiTokenSetting = geminiExtension.settings?.find(
  (setting) => setting.envVar === "DISCORD_TOKEN",
);
assert(
  geminiExtension.name === "discord-mcp" &&
    geminiServer?.command === "npx" &&
    JSON.stringify(geminiServer.args) ===
      JSON.stringify(["-y", `${packageJson.name}@${packageJson.version}`]),
  "gemini-extension.json must run the exactly pinned npm package.",
);
assert(
  JSON.stringify(geminiExtension.settings?.map((setting) => setting.envVar)) ===
    JSON.stringify([
      "DISCORD_TOKEN",
      "DISCORD_ALLOWED_GUILD_IDS",
      "DISCORD_ALLOWED_CHANNEL_IDS",
      "DISCORD_ENABLE_WRITES",
      "DISCORD_ENABLE_DELETES",
      "DISCORD_ALLOW_UNRESTRICTED_WRITES",
      "DISCORD_MAX_RESPONSE_CHARS",
    ]) &&
    geminiTokenSetting?.sensitive === true &&
    geminiExtension.settings.filter((setting) => setting.sensitive === true)
      .length === 1 &&
    geminiServer.env?.DISCORD_TOKEN === "${DISCORD_TOKEN}" &&
    Object.values(geminiServer.env).every(
      (value) => typeof value === "string" && value.startsWith("${"),
    ),
  "Gemini must map every supported setting while keeping only DISCORD_TOKEN sensitive.",
);

const mcpbTokenConfig = mcpbManifest.user_config?.discord_token;
const sensitiveMcpbKeys = Object.entries(mcpbManifest.user_config ?? {})
  .filter(([, config]) => config.sensitive === true)
  .map(([key]) => key);
assert(
  mcpbManifest.manifest_version === "0.3" &&
    mcpbManifest.server?.type === "node" &&
    mcpbManifest.server?.entry_point === "server/discord-mcp.cjs" &&
    mcpbManifest.server?.mcp_config?.command === "node",
  "MCPB must use the official v0.3 Node manifest and shared server bundle.",
);
assert(
  sensitiveMcpbKeys.length === 1 &&
    sensitiveMcpbKeys[0] === "discord_token" &&
    mcpbTokenConfig?.type === "string" &&
    mcpbTokenConfig.required === true &&
    mcpbTokenConfig.default === undefined &&
    mcpbManifest.server?.mcp_config?.env?.DISCORD_TOKEN ===
      "${user_config.discord_token}",
  "MCPB must receive DISCORD_TOKEN only through required sensitive user_config.",
);

const cursorConfig = {
  command: "npx",
  args: ["-y", `${packageJson.name}@${packageJson.version}`],
  env: {
    DISCORD_TOKEN: "${env:DISCORD_TOKEN}",
    DISCORD_ENABLE_WRITES: "false",
    DISCORD_ENABLE_DELETES: "false",
    DISCORD_ALLOW_UNRESTRICTED_WRITES: "false",
  },
};
const expectedCursorLink =
  "cursor://anysphere.cursor-deeplink/mcp/install" +
  `?name=discord-mcp&config=${Buffer.from(JSON.stringify(cursorConfig)).toString("base64")}`;
assert(
  readme.includes(expectedCursorLink),
  "README.md must contain the current official Cursor install deep link.",
);

function assertDocumentVersions(contents, label, allowedExtraVersions = []) {
  const versions = [
    ...contents.matchAll(
      /(?:@hypark5540\/discord-mcp@|hypark-discord-mcp==|ghcr\.io\/hypark5540\/discord-mcp:|git (?:tag|push origin) v)(\d+\.\d+\.\d+)/g,
    ),
  ].map((match) => match[1]);
  assert(versions.length > 0, `${label} must contain the current version.`);
  const allowedVersions = new Set([packageJson.version, ...allowedExtraVersions]);
  assert(
    versions.every((version) => allowedVersions.has(version)),
    `${label} contains a stale project version: ${[...new Set(versions)].join(", ")}`,
  );
}

assertDocumentVersions(readme, "README.md");
assertDocumentVersions(releaseGuide, "docs/releasing.md", ["0.0.0"]);
assertDocumentVersions(clientGuide, "docs/clients.md");
assertDocumentVersions(aiInstallGuide, "docs/ai-install.md");

const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  [
    "pyproject.toml",
    capture(pyproject, /^version\s*=\s*"([^"]+)"/m, "pyproject.toml"),
  ],
  [
    "python package",
    capture(pythonInit, /^__version__\s*=\s*"([^"]+)"/m, "Python package"),
  ],
  [
    "TypeScript source",
    capture(sourceVersion, /^export const VERSION = "([^"]+)";/m, "TypeScript source"),
  ],
  ["server.json", serverJson.version],
  ["gemini-extension.json", geminiExtension.version],
  ["mcpb/manifest.json", mcpbManifest.version],
  [
    "Dockerfile ARG",
    capture(dockerfile, /^ARG VERSION=([^\s]+)$/m, "Dockerfile ARG VERSION"),
  ],
]);

for (const [index, entry] of serverJson.packages.entries()) {
  if (entry.registryType !== "oci") {
    versions.set(`server.json packages[${index}]`, entry.version);
  } else if (!entry.identifier.endsWith(`:${serverJson.version}`)) {
    throw new Error(
      `server.json OCI identifier must end in :${serverJson.version}: ${entry.identifier}`,
    );
  }
}

const expected = packageJson.version;
const mismatches = [...versions].filter(([, version]) => version !== expected);
if (mismatches.length > 0) {
  throw new Error(
    `Version mismatch; expected ${expected}: ${mismatches
      .map(([label, version]) => `${label}=${String(version)}`)
      .join(", ")}`,
  );
}

console.log(`All package, client, and registry metadata match: ${expected}`);
