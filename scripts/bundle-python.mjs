import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, "bundle/discord-mcp.cjs");
const noticesFile = resolve(root, "bundle/THIRD_PARTY_NOTICES.txt");
const sbomFile = resolve(root, "bundle/sbom.cdx.json");
const pythonOutfile = resolve(
  root,
  "python/src/hypark_discord_mcp/_bundled/server.cjs",
);
const pythonNoticesFile = resolve(
  root,
  "python/src/hypark_discord_mcp/_bundled/THIRD_PARTY_NOTICES.txt",
);
const pythonSbomFile = resolve(
  root,
  "python/src/hypark_discord_mcp/_bundled/sbom.cdx.json",
);
const projectMetadata = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const licenseFallbacks = new Map([
  [
    "@sapphire/async-queue@1.5.5",
    resolve(root, "licenses/sapphire-utilities-MIT.txt"),
  ],
  [
    "@sapphire/snowflake@3.5.5",
    resolve(root, "licenses/sapphire-utilities-MIT.txt"),
  ],
]);
const requiredLicenseFiles = new Map([
  [
    "@vladfrangu/async_event_emitter@2.4.7",
    ["LICENSE.md", "THIRD_PARTY_LICENSE.md"],
  ],
]);

function packageRootFromInput(input) {
  const parts = input.split(/[\\/]/);
  const nodeModulesIndex = parts.lastIndexOf("node_modules");
  if (nodeModulesIndex === -1) return undefined;

  const first = parts[nodeModulesIndex + 1];
  if (!first) return undefined;
  const packageParts = first.startsWith("@")
    ? [first, parts[nodeModulesIndex + 2]]
    : [first];
  if (packageParts.some((part) => !part)) return undefined;
  return resolve(root, ...parts.slice(0, nodeModulesIndex + 1), ...packageParts);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function splitNpmName(packageName) {
  if (!packageName.startsWith("@")) {
    return { name: packageName };
  }

  const separator = packageName.indexOf("/");
  if (separator < 2 || separator === packageName.length - 1) {
    throw new Error(`Invalid scoped npm package name: ${packageName}`);
  }
  return {
    group: packageName.slice(0, separator),
    name: packageName.slice(separator + 1),
  };
}

function npmPurl(packageName, version) {
  const { group, name } = splitNpmName(packageName);
  const namespace = group
    ? `%40${encodeURIComponent(group.slice(1))}/`
    : "";
  return `pkg:npm/${namespace}${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function cycloneDxLicenses(license) {
  const value = typeof license === "string" && license.trim()
    ? license.trim()
    : "Not declared";
  if (/\s|\(|\)/.test(value)) {
    return [{ expression: value }];
  }
  return [{ license: { id: value } }];
}

async function collectBundledPackages(inputs) {
  const packageRoots = [
    ...new Set(Object.keys(inputs).map(packageRootFromInput).filter(Boolean)),
  ].sort(compareText);
  const uniquePackages = new Map();
  const packageByRoot = new Map();

  for (const packageRoot of packageRoots) {
    const metadata = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
    if (typeof metadata.name !== "string" || typeof metadata.version !== "string") {
      throw new Error(`Bundled package metadata is incomplete: ${packageRoot}`);
    }
    const files = await readdir(packageRoot);
    const licenseFiles = files
      .filter((file) =>
        /^(?:(?:third[_-]party[_-])?(?:licen[cs]e(?:s)?|notice(?:s)?)|copying)(?:\..*)?$/i.test(
          file,
        ),
      )
      .sort();
    const packageId = `${metadata.name}@${metadata.version}`;
    for (const requiredFile of requiredLicenseFiles.get(packageId) ?? []) {
      if (!licenseFiles.includes(requiredFile)) {
        throw new Error(`${packageId} is missing required notice ${requiredFile}.`);
      }
    }
    let licenseTexts = await Promise.all(
      licenseFiles.map(async (file) => ({
        file,
        contents: (await readFile(resolve(packageRoot, file), "utf8")).trim(),
      })),
    );
    if (licenseTexts.length === 0) {
      const fallback = licenseFallbacks.get(
        `${metadata.name}@${metadata.version}`,
      );
      if (!fallback) {
        throw new Error(
          `${metadata.name}@${metadata.version} is bundled but has no license file or vetted fallback.`,
        );
      }
      licenseTexts = [
        {
          file: "UPSTREAM LICENSE.md",
          contents: (await readFile(fallback, "utf8")).trim(),
        },
      ];
    }
    const entry = {
      name: metadata.name,
      version: metadata.version,
      license: metadata.license ?? "Not declared",
      licenseTexts,
      purl: npmPurl(metadata.name, metadata.version),
    };
    const canonicalEntry = uniquePackages.get(packageId) ?? entry;
    uniquePackages.set(packageId, canonicalEntry);
    packageByRoot.set(packageRoot, canonicalEntry);
  }

  return {
    packageByRoot,
    packages: [...uniquePackages.values()].sort((left, right) =>
      compareText(left.purl, right.purl)),
  };
}

async function generateThirdPartyNotices(packages) {
  const sections = packages
    .map((entry) => {
      const heading = `${entry.name}@${entry.version} (${String(entry.license)})`;
      const texts = entry.licenseTexts
        .map(({ file, contents }) => `--- ${file} ---\n${contents}`)
        .join("\n\n");
      return `${heading}\n${"=".repeat(heading.length)}\n${texts}`;
    });

  const header = [
    "Discord MCP third-party notices",
    "",
    "This file is generated from the dependency files included in server.cjs.",
    "The project itself is licensed under the MIT License; see LICENSE.",
    "",
    "",
  ].join("\n");
  await writeFile(noticesFile, `${header}${sections.join("\n\n")}\n`, "utf8");
}

function componentForPackage(entry, type = "library") {
  const { group, name } = splitNpmName(entry.name);
  return {
    type,
    "bom-ref": entry.purl,
    ...(group ? { group } : {}),
    name,
    version: entry.version,
    licenses: cycloneDxLicenses(entry.license),
    purl: entry.purl,
  };
}

async function generateCycloneDxSbom(inputs, inventory) {
  const project = {
    name: projectMetadata.name,
    version: projectMetadata.version,
    license: projectMetadata.license,
    purl: npmPurl(projectMetadata.name, projectMetadata.version),
  };
  const dependencyRefs = new Map([
    [project.purl, new Set()],
    ...inventory.packages.map((entry) => [entry.purl, new Set()]),
  ]);

  for (const [input, details] of Object.entries(inputs)) {
    const sourcePackage = inventory.packageByRoot.get(packageRootFromInput(input));
    const sourceRef = sourcePackage?.purl ?? project.purl;
    for (const imported of details.imports ?? []) {
      if (imported.external) continue;
      const targetPackage = inventory.packageByRoot.get(
        packageRootFromInput(imported.path),
      );
      if (targetPackage && targetPackage.purl !== sourceRef) {
        dependencyRefs.get(sourceRef)?.add(targetPackage.purl);
      }
    }
  }

  const sbom = {
    "$schema": "https://cyclonedx.org/schema/bom-1.6.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: {
        ...componentForPackage(project, "application"),
        description: projectMetadata.description,
      },
    },
    components: inventory.packages.map((entry) => componentForPackage(entry)),
    dependencies: [...dependencyRefs]
      .sort(([left], [right]) => compareText(left, right))
      .map(([ref, dependsOn]) => ({
        ref,
        dependsOn: [...dependsOn].sort(compareText),
      })),
  };
  await writeFile(sbomFile, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
}

await mkdir(dirname(outfile), { recursive: true });
await mkdir(dirname(pythonOutfile), { recursive: true });
const result = await build({
  entryPoints: [resolve(root, "src/index.ts")],
  absWorkingDir: root,
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "bundle",
  legalComments: "eof",
  metafile: true,
  sourcemap: false,
});
const inventory = await collectBundledPackages(result.metafile.inputs);
await generateThirdPartyNotices(inventory.packages);
await generateCycloneDxSbom(result.metafile.inputs, inventory);
await chmod(outfile, 0o755);
await copyFile(outfile, pythonOutfile);
await copyFile(noticesFile, pythonNoticesFile);
await copyFile(sbomFile, pythonSbomFile);

console.log(`Built shared MCP bundle: ${outfile}`);
console.log(`Copied shared bundle into the PyPI package: ${pythonOutfile}`);
console.log(`Generated third-party notices: ${noticesFile.split(sep).at(-1)}`);
console.log(`Generated CycloneDX SBOM: ${sbomFile.split(sep).at(-1)}`);
