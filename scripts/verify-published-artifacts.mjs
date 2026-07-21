import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const pyproject = await readFile(resolve(root, "pyproject.toml"), "utf8");
const pypiName = pyproject.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const [registry, ...artifacts] = process.argv.slice(2);

if (!pypiName || !["npm", "pypi"].includes(registry) || artifacts.length === 0) {
  console.error(
    "Usage: node scripts/verify-published-artifacts.mjs <npm|pypi> <artifact...>",
  );
  process.exit(2);
}

async function digest(path, algorithm, encoding = "hex") {
  return createHash(algorithm).update(await readFile(path)).digest(encoding);
}

async function fetchMetadata(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Registry metadata request failed (${response.status}): ${url}`);
  }
  return response.json();
}

async function verifyNpm() {
  if (artifacts.length !== 1 || !artifacts[0].endsWith(".tgz")) {
    throw new Error("npm verification expects exactly one .tgz artifact.");
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageJson.name)}/${encodeURIComponent(packageJson.version)}`;
  const metadata = await fetchMetadata(url);
  if (!metadata) return "missing";

  const localIntegrity = `sha512-${await digest(artifacts[0], "sha512", "base64")}`;
  if (metadata.dist?.integrity !== localIntegrity) {
    throw new Error(
      `Published npm integrity differs for ${packageJson.name}@${packageJson.version}.`,
    );
  }
  return "matching";
}

async function verifyPypi() {
  const url = `https://pypi.org/pypi/${encodeURIComponent(pypiName)}/${encodeURIComponent(packageJson.version)}/json`;
  const metadata = await fetchMetadata(url);
  if (!metadata) return "missing";

  const remoteByFilename = new Map(
    metadata.urls.map((entry) => [entry.filename, entry.digests?.sha256]),
  );
  if (remoteByFilename.size !== artifacts.length) {
    throw new Error(
      `Published PyPI file count differs for ${pypiName}==${packageJson.version}.`,
    );
  }
  for (const artifact of artifacts) {
    const filename = basename(artifact);
    const localSha256 = await digest(artifact, "sha256");
    if (remoteByFilename.get(filename) !== localSha256) {
      throw new Error(`Published PyPI digest differs for ${filename}.`);
    }
  }
  return "matching";
}

try {
  const status = registry === "npm" ? await verifyNpm() : await verifyPypi();
  process.stdout.write(`${status}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
