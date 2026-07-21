import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const npmSbom = await readFile(resolve(root, "bundle/sbom.cdx.json"));
const pythonSbom = await readFile(
  resolve(root, "python/src/hypark_discord_mcp/_bundled/sbom.cdx.json"),
);
const notices = await readFile(
  resolve(root, "bundle/THIRD_PARTY_NOTICES.txt"),
  "utf8",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function packageName(component) {
  return component.group ? `${component.group}/${component.name}` : component.name;
}

assert(
  npmSbom.equals(pythonSbom),
  "The npm and Python CycloneDX SBOM files must be byte-identical.",
);

const sbomText = npmSbom.toString("utf8");
const sbom = JSON.parse(sbomText);
assert(
  sbomText === `${JSON.stringify(sbom, null, 2)}\n`,
  "The CycloneDX SBOM must use deterministic two-space JSON formatting.",
);
assert(sbom.$schema === "https://cyclonedx.org/schema/bom-1.6.schema.json", "Unexpected SBOM schema.");
assert(sbom.bomFormat === "CycloneDX", "Unexpected SBOM format.");
assert(sbom.specVersion === "1.6", "Unexpected CycloneDX version.");
assert(sbom.version === 1, "The SBOM document version must be 1.");

const rootComponent = sbom.metadata?.component;
assert(rootComponent?.type === "application", "The SBOM root must be an application component.");
assert(packageName(rootComponent) === packageJson.name, "The SBOM root package name is stale.");
assert(rootComponent.version === packageJson.version, "The SBOM root version is stale.");
assert(rootComponent["bom-ref"] === rootComponent.purl, "The SBOM root ref must use its purl.");

const components = sbom.components ?? [];
const componentRefs = components.map((component) => component["bom-ref"]);
assert(components.length > 0, "The SBOM must list bundled components.");
assert(
  new Set(componentRefs).size === componentRefs.length,
  "The SBOM contains duplicate component refs.",
);
assert(
  componentRefs.every((ref, index) => index === 0 || compareText(componentRefs[index - 1], ref) < 0),
  "The SBOM components must be sorted by ref.",
);
for (const component of components) {
  assert(component.type === "library", `Unexpected component type for ${component["bom-ref"]}.`);
  assert(component["bom-ref"] === component.purl, `Component ref must use purl: ${component["bom-ref"]}.`);
  assert(typeof component.name === "string" && component.name, "A component name is missing.");
  assert(typeof component.version === "string" && component.version, "A component version is missing.");
  assert(component.licenses?.length > 0, `Component license is missing: ${component["bom-ref"]}.`);
}

const noticePackageIds = [];
const noticeLines = notices.split("\n");
for (let index = 0; index < noticeLines.length - 1; index += 1) {
  const heading = noticeLines[index];
  if (noticeLines[index + 1] !== "=".repeat(heading.length)) continue;
  const match = heading.match(/^(.+)@([^@\s]+) \(.+\)$/);
  if (match) noticePackageIds.push(`${match[1]}@${match[2]}`);
}
const sbomPackageIds = components.map(
  (component) => `${packageName(component)}@${component.version}`,
);
assert(
  JSON.stringify([...noticePackageIds].sort(compareText)) ===
    JSON.stringify([...sbomPackageIds].sort(compareText)),
  "The SBOM inventory differs from THIRD_PARTY_NOTICES.txt.",
);

const validRefs = new Set([rootComponent["bom-ref"], ...componentRefs]);
const dependencies = sbom.dependencies ?? [];
assert(
  dependencies.length === validRefs.size,
  "The SBOM dependency graph must contain the root and every component.",
);
assert(
  new Set(dependencies.map((entry) => entry.ref)).size === dependencies.length,
  "The SBOM dependency graph contains duplicate refs.",
);
for (const dependency of dependencies) {
  assert(validRefs.has(dependency.ref), `Unknown dependency graph ref: ${dependency.ref}.`);
  const dependsOn = dependency.dependsOn ?? [];
  assert(new Set(dependsOn).size === dependsOn.length, `Duplicate dependency edge: ${dependency.ref}.`);
  assert(
    dependsOn.every((ref, index) =>
      validRefs.has(ref) &&
      ref !== dependency.ref &&
      (index === 0 || compareText(dependsOn[index - 1], ref) < 0)),
    `Invalid or unsorted dependency edge: ${dependency.ref}.`,
  );
}

console.log(`Verified CycloneDX SBOM: ${components.length} bundled components`);
