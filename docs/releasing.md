# Release guide

This project ships one TypeScript implementation through four artifact formats:

- npm: `@hypark5540/discord-mcp`
- PyPI: `hypark-discord-mcp` (a Python launcher containing the bundled JS)
- OCI/GHCR: `ghcr.io/hypark5540/discord-mcp`
- Claude Desktop MCPB: `discord-mcp-0.1.0.mcpb` on GitHub Releases

The official MCP Registry entry is `io.github.hypark5540/discord-mcp` and links
the npm, PyPI, and OCI packages. Registry and package names are intentionally
different because the unscoped `discord-mcp` name is already owned by third
parties on npm and PyPI.

Every format contains the same generated JavaScript server, third-party license
notices, and deterministic CycloneDX 1.6 SBOM. The release workflow compares
these files byte-for-byte, double-builds the npm/PyPI/MCPB archives, and rejects
any reproducibility drift. Release validation pins Node `24.18.0`, npm `11.16.0`
(bundled with that Node release), uv `0.11.29`, and a fixed
`SOURCE_DATE_EPOCH`.

## One-time setup

### 1. GitHub repository and environments

1. Create the public `github.com/hypark5540/discord-mcp` repository and push
   `main`.
2. Create the `release`, `pypi`, and `mcp-registry` environments. Restrict
   deployments to protected tags matching `v*`; use a required reviewer while
   bootstrapping the first release.
3. Add a repository ruleset that prevents updates and deletion of `v*` tags.
   After the first CI run, protect `main` with the CI and CodeQL checks.
4. Enable private vulnerability reporting. Keep GitHub Actions permissions at
   the least privilege requested by each workflow job.

### 2. Bootstrap npm without sacrificing 0.1.0 provenance

npm requires the package to exist before `npm trust` can configure an OIDC
publisher. Publish the inert `0.0.0` bootstrap under the non-default
`bootstrap` dist-tag, then let GitHub Actions publish the real `0.1.0` package
with provenance.

The following wrapper uses the exact Node release from the workflow and
`npm@11.18.0`, which provides the `npm trust` command. npm account-level 2FA is
required. Authentication happens in the browser; never paste a token into this
repository.

```bash
npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm login --auth-type=web'

npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm run build:npm-bootstrap'

npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm publish release-artifacts/npm-bootstrap/*.tgz --access public --tag bootstrap'

npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm trust github @hypark5540/discord-mcp --repo hypark5540/discord-mcp --file release.yml --env release --allow-publish --yes'

npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm trust list @hypark5540/discord-mcp'
```

Inspect the bootstrap tarball before publishing it. It contains only
`package.json`, `README.md`, and `LICENSE`; it has no executable or dependency.

### 3. Configure PyPI Trusted Publishing

Create a pending publisher at `pypi.org/manage/account/publishing/` with these
exact values:

- PyPI project name: `hypark-discord-mcp`
- GitHub owner: `hypark5540`
- Repository: `discord-mcp`
- Workflow: `release.yml`
- Environment: `pypi`

The first `0.1.0` upload can then be created directly by GitHub OIDC; no PyPI
API token or manual placeholder release is needed.

### 4. First GHCR and MCP Registry publication

The first Actions push creates the personal-account GHCR package as private.
Keep the `mcp-registry` environment approval pending until the container job
finishes, then change `ghcr.io/hypark5540/discord-mcp` to **Public** in GitHub
Packages and approve the registry job. Visibility remains public for later
versions. GitHub does not expose a supported personal-package visibility-change
API, and making a package public is irreversible.

After all OIDC paths have succeeded, set npm Publishing access to require 2FA
and disallow traditional publish tokens. Remove any temporary registry token;
this repository does not require long-lived npm, PyPI, GHCR, or MCP Registry
secrets.

## Cut a release

Keep these versions identical:

- `package.json` and `package-lock.json`
- `src/version.ts`
- `pyproject.toml` and `python/src/hypark_discord_mcp/__init__.py`
- `server.json`, including every package entry and the OCI tag
- `mcpb/manifest.json` and `gemini-extension.json`
- `Dockerfile`, `README.md`, `mcp.example.json`, and versioned client/release
  guides

The version consistency script enforces this list and regenerates the Cursor
deep link expectation. Before tagging, run:

```bash
npm run deps:locked
npm run check
npm run build:pypi
npm pack --dry-run
npm audit --audit-level=high
```

`deps:locked` deliberately disables every dependency lifecycle script and then
rebuilds only the reviewed, lockfile-pinned `esbuild@0.28.1` package.

Commit the version update, create an immutable matching tag, and push it:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow then:

1. validates 100% coverage, schemas, SBOM, stdio handshakes, archive
   reproducibility, and cross-format bundle identity;
2. publishes npm and PyPI through OIDC and GHCR with provenance/SBOM;
3. signs GitHub artifact provenance and creates a Release containing the exact
   validated MCPB and its SHA-256 file; and
4. publishes `server.json` to the official MCP Registry.

The GitHub Release job never clobbers an asset. A rerun downloads and compares
an existing same-name asset byte-for-byte; a mismatch fails closed. npm/PyPI
versions and versioned GHCR tags are likewise reused only after integrity or
source-revision checks pass.

After the first successful real npm release, deprecate the inert bootstrap:

```bash
npx --yes --package=node@24.18.0 --package=npm@11.18.0 \
  --call 'npm deprecate @hypark5540/discord-mcp@0.0.0 "Bootstrap only; use 0.1.0 or later."'
```

## Failure and retry policy

Package registries do not support an atomic multi-registry transaction. If one
job fails after another artifact was published, correct only external
configuration or a transient service failure and rerun the failed job. A rerun
uses the workflow from the original tagged commit and retains validated
workflow artifacts for 90 days.

Never move or recreate a release tag. If source, metadata, dependencies, or a
workflow file must change, publish a new patch version. Existing npm/PyPI
versions, versioned containers, MCP Registry versions, and published GitHub
Release assets are treated as immutable and are never overwritten with
different bytes.
