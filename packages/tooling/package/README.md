<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="package" />

</a>

<h3 align="center">A comprehensive package management utility that helps you find root directories, monorepos, package managers, and parse package.json, package.yaml, and package.json5 files with advanced features like catalog resolution.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```bash
npm install @visulima/package
```

```bash
yarn add @visulima/package
```

```bash
pnpm add @visulima/package
```

## API

### Monorepo Detection

#### findMonorepoRoot

Finds the root directory and strategy for a monorepo by searching for workspace configuration files.

```typescript
import { findMonorepoRoot } from "@visulima/package";

const result = await findMonorepoRoot();
// => { path: '/path/to/monorepo', strategy: 'pnpm' }
```

Supports detection of:

- pnpm workspaces (pnpm-workspace.yaml)
- npm/yarn workspaces (package.json workspaces field)
- Lerna (lerna.json)
- Turborepo (turbo.json)

### Package Detection

#### findPackageRoot

Finds the root directory of a package by locating its package.json file.

```typescript
import { findPackageRoot } from "@visulima/package";

const result = await findPackageRoot();
// => { path: '/path/to/package', strategy: 'package' }
```

#### findPackageJson

Finds and parses a package.json, package.yaml, or package.json5 file, searching parent directories if needed.

```typescript
import { findPackageJson } from "@visulima/package";

// Basic usage - searches for package.json, package.yaml, and package.json5
const result = await findPackageJson();
// => { packageJson: { name: 'my-package', ... }, path: '/path/to/package.json' }

// With options to enable/disable specific formats and features
const result = await findPackageJson("/path/to/project", {
    yaml: true, // Enable package.yaml support (default: true)
    json5: true, // Enable package.json5 support (default: true)
    resolveCatalogs: true, // Resolve pnpm catalog references (default: false)
    cache: true, // Enable caching of parsed results (default: false)
});
```

**File Search Priority**: The function searches for files in the following order:

1. `package.json` (highest priority)
2. `package.yaml`
3. `package.json5` (lowest priority)

**Supported Formats**:

- **package.json**: Standard JSON format
- **package.yaml**: YAML format (introduced in pnpm/pnpm#1799)
- **package.json5**: JSON5 format with comments and trailing commas support

**Additional Options**:

- **resolveCatalogs**: Resolve pnpm catalog references to actual versions (requires pnpm workspace)
- **cache**: Cache parsed results to improve performance on repeated calls

### Package Manager Detection

#### findPackageManager

Detects the package manager used in a project by examining lock files and package.json.

```typescript
import { findPackageManager } from "@visulima/package";

const result = await findPackageManager();
// => { packageManager: 'pnpm', path: '/path/to/project' }
```

#### findLockFile

Finds the lock file for the current project.

```typescript
import { findLockFile } from "@visulima/package";

const lockFile = await findLockFile();
// => '/path/to/pnpm-lock.yaml'
```

#### getPackageManagerVersion

Retrieves the version of a specific package manager.

```typescript
import { getPackageManagerVersion } from "@visulima/package";

const version = await getPackageManagerVersion("pnpm");
// => '8.15.0'
```

> `getPackageManagerVersion` only accepts the known managers (`npm`, `pnpm`, `yarn`, `bun`) and throws on anything else, so a `packageManager`-derived value from an untrusted repo can't be executed as an arbitrary binary.

#### identifyInitiatingPackageManager

Detects which package manager is currently executing the process by reading the `npm_config_user_agent` environment variable. Useful inside `postinstall`/`prepare` scripts to print the right install command. Returns `undefined` when the variable is not set.

```typescript
import { identifyInitiatingPackageManager } from "@visulima/package";

const pm = identifyInitiatingPackageManager();
// => { name: 'pnpm', version: '8.15.0' } | { name: 'cnpm', ... } | undefined
```

#### generateMissingPackagesInstallMessage

Builds a human-readable message instructing the user how to install missing packages with each requested package manager.

```typescript
import { generateMissingPackagesInstallMessage } from "@visulima/package";

const message = generateMissingPackagesInstallMessage("my-tool", ["typescript", "@types/node"], {
    packageManagers: ["npm", "pnpm", "yarn"], // default: ["npm", "pnpm", "yarn"]
    preMessage: "Some optional dependencies are missing.\n",
    postMessage: "\nSee the docs for details.",
});

console.log(message);
// my-tool could not find the following packages
//   typescript
//   @types/node
// To install the missing packages, please run the following command:
//   npm install typescript@latest @types/node@latest --save-dev
//   ...
```

### Package.json Operations

#### parsePackageJson

Parses and normalizes package.json, package.yaml, or package.json5 data with optional catalog resolution support.

```typescript
import { parsePackageJson } from "@visulima/package";

// Basic parsing - automatically detects format by file extension
const packageJson = await parsePackageJson("./package.json");
const packageYaml = await parsePackageJson("./package.yaml");
const packageJson5 = await parsePackageJson("./package.json5");

// With catalog resolution (pnpm workspaces only)
const packageJson = await parsePackageJson("./package.json", {
    resolveCatalogs: true,
});

// With format control and caching options
const packageJson = await parsePackageJson("./package.yaml", {
    yaml: true, // Enable package.yaml support (default: true)
    json5: false, // Disable package.json5 support (default: true)
    resolveCatalogs: true, // Resolve pnpm catalog references (default: false)
    cache: true, // Enable caching for file-based parsing (default: false)
});

// Synchronous version
import { parsePackageJsonSync } from "@visulima/package";

const packageJson = parsePackageJsonSync("./package.json", {
    resolveCatalogs: true,
    cache: true, // Enable caching for file-based parsing (default: false)
});
```

**Supported File Formats**:

- **package.json**: Standard JSON format
- **package.yaml**: YAML format with support for comments and more readable syntax
- **package.json5**: JSON5 format with support for comments, trailing commas, and unquoted keys

**Format Detection**: The function automatically detects the file format based on the file extension:

- `.json` → JSON parsing
- `.yaml` or `.yml` → YAML parsing
- `.json5` → JSON5 parsing

**Caching**: When `cache: true` is set, the function uses a global cache to store parsed results for file-based inputs only (not for object or JSON string inputs). This can improve performance when parsing the same file multiple times.

```typescript
// File-based caching with global cache
const result1 = await parsePackageJson("./package.json", { cache: true }); // Parses and caches
const result2 = await parsePackageJson("./package.json", { cache: true }); // Returns cached result

// Custom cache instance
const myCache = new Map();
const result3 = await parsePackageJson("./package.json", { cache: myCache }); // Uses custom cache

// Objects and strings are never cached
const result4 = await parsePackageJson({ name: "test" }, { cache: true }); // Always parsed fresh
```

The module-level cache used when `cache: true` (and no custom cache is supplied) never expires on its own. Writing through `writePackageJson[Sync]` evicts the written path automatically, but if you mutate a package file out of band (e.g. in a long-running process or test), call `clearPackageJsonCache()` to drop all cached reads:

```typescript
import { clearPackageJsonCache } from "@visulima/package";

clearPackageJsonCache();
```

**Example File Formats**:

```yaml
# package.yaml
name: my-package
version: 1.0.0
dependencies:
    react: ^18.0.0
    typescript: ^5.0.0
scripts:
    build: "tsc"
    test: "vitest"
```

```json5
// package.json5
{
    name: "my-package",
    version: "1.0.0",
    dependencies: {
        react: "^18.0.0",
        typescript: "^5.0.0",
    },
    scripts: {
        build: "tsc",
        test: "vitest",
    },
}
```

**Catalog Resolution**: When `resolveCatalogs: true` is set, the function will:

1. Search for `pnpm-workspace.yaml` in parent directories
2. Verify the package.json is part of the workspace
3. Resolve catalog references like `"react": "catalog:"` to actual versions

Example with pnpm catalogs:

```yaml
# pnpm-workspace.yaml
catalog:
    react: ^18.0.0
    typescript: ^5.0.0

catalogs:
    next:
        react: ^19.0.0

packages:
    - packages/*
```

```json
// package.json
{
    "dependencies": {
        "react": "catalog:",
        "typescript": "catalog:",
        "next": "catalog:next"
    }
}
```

After resolution:

```json
{
    "dependencies": {
        "react": "^18.0.0",
        "typescript": "^5.0.0",
        "next": "^19.0.0"
    }
}
```

#### writePackageJson

Writes normalized package.json data to a file.

```typescript
import { writePackageJson } from "@visulima/package";

await writePackageJson({
    name: "my-package",
    version: "1.0.0",
});
```

#### Package.json Utilities

```typescript
import { getPackageJsonProperty, hasPackageJsonProperty, hasPackageJsonAnyDependency } from "@visulima/package";

const packageJson = await parsePackageJson("./package.json");

// Get a property value
const name = getPackageJsonProperty(packageJson, "name");

// Check if property exists
const hasScripts = hasPackageJsonProperty(packageJson, "scripts");

// Check for dependencies
const hasReact = hasPackageJsonAnyDependency(packageJson, ["react", "preact"]);
```

### Package Installation

#### ensurePackages

Ensures specified packages are installed, prompting the user if needed.

```typescript
import { ensurePackages } from "@visulima/package";

await ensurePackages(packageJson, ["typescript", "@types/node"], "devDependencies");
```

### Lockfile Parsing

A regex-based lockfile parser (no YAML dependency) covering all four mainstream JS package managers. Each entry is normalized to `{ name, version, integrity?, dependencies?, peerDependencies?, optionalDependencies? }`, so callers can build SBOMs, dedupe reports, or any other lockfile-derived artifact from a single source of truth.

Integrity support:

- **npm** (`package-lock.json` v2/v3): `integrity: "sha512-…"` ✅
- **pnpm** (`pnpm-lock.yaml`): `resolution: { integrity: "sha512-…" }` ✅
- **yarn v1** (Classic): `integrity "sha512-…"` ✅
- **yarn v2+** (Berry): emits `checksum: 10c0/…` (XXH64), which is not a cryptographic hash and is outside the CycloneDX 1.6 `HashAlgorithm` enum. Berry entries are still parsed (name / version / dependencies), but `integrity` is `undefined`.
- **bun** (`bun.lock`): `[versionKey, registryUrl, metadata, integrity]` tuples ✅

#### parseLockFile

Walks up from `cwd`, locates the nearest supported lockfile, reads it, and returns the parsed entries alongside the lockfile type and absolute path.

```typescript
import { parseLockFile, parseLockFileSync } from "@visulima/package";

const result = await parseLockFile();
// => { entries: [{ name: 'react', version: '18.2.0', integrity: { algorithm: 'sha512', hex: '…' } }, …], path: '/path/to/pnpm-lock.yaml', type: 'pnpm' }

// Synchronous version
const resultSync = parseLockFileSync("./some/dir");
```

#### Per-package-manager parsers

When you already have the lockfile contents (and know the format), call a specific parser directly. Each returns a `LockFileEntry[]`.

```typescript
import { parseNpmLockFile, parsePnpmLockFile, parseYarnLockFile, parseBunLockFile } from "@visulima/package";
import { readFileSync } from "node:fs";

const entries = parsePnpmLockFile(readFileSync("./pnpm-lock.yaml", "utf8"));
```

#### decodeSriIntegrity

Decodes a Subresource Integrity string (`sha512-<base64>`) into a `{ algorithm, hex }` pair. Returns `undefined` if the string is malformed, oversized, or uses an unsupported algorithm.

```typescript
import { decodeSriIntegrity } from "@visulima/package";

const integrity = decodeSriIntegrity("sha512-…");
// => { algorithm: 'sha512', hex: '…' } | undefined
```

### pnpm Catalogs & Workspaces

Helpers for reading and resolving pnpm [catalog](https://pnpm.io/catalogs) references from `pnpm-workspace.yaml`.

#### readPnpmCatalogs

Reads the catalog definitions for the workspace that owns `packagePath`. Returns `undefined` when the package is not part of a pnpm workspace.

```typescript
import { readPnpmCatalogs, readPnpmCatalogsSync } from "@visulima/package";

const catalogs = await readPnpmCatalogs("./packages/app/package.json");
// => { default: { react: '^18.0.0' }, named: { next: { react: '^19.0.0' } } } | undefined
```

#### isPackageInWorkspace

Checks whether a package path is covered by a workspace's `packages:` globs.

```typescript
import { isPackageInWorkspace } from "@visulima/package";

const inWorkspace = isPackageInWorkspace("/repo", "/repo/packages/app", ["packages/*"]);
// => true
```

> Catalog references are also resolved automatically when you pass `resolveCatalogs: true` to `parsePackageJson[Sync]` / `findPackageJson[Sync]` (see above).

### Subpath Exports

Every concern ships as its own entry point. Import from the narrowest one for the best tree-shaking — the root (`@visulima/package`) re-exports everything but pulls in all modules.

| Subpath                             | Contents                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@visulima/package/monorepo`        | `findMonorepoRoot[Sync]`                                                                                                                                  |
| `@visulima/package/package`         | `findPackageRoot[Sync]`                                                                                                                                   |
| `@visulima/package/package-json`    | `findPackageJson[Sync]`, `parsePackageJson[Sync]`, `writePackageJson[Sync]`, `clearPackageJsonCache`, property helpers, `ensurePackages`                  |
| `@visulima/package/package-manager` | `findPackageManager[Sync]`, `findLockFile[Sync]`, `getPackageManagerVersion`, `identifyInitiatingPackageManager`, `generateMissingPackagesInstallMessage` |
| `@visulima/package/lockfile`        | `parseLockFile[Sync]`, `parseNpmLockFile`, `parsePnpmLockFile`, `parseYarnLockFile`, `parseBunLockFile`, `decodeSriIntegrity`                             |
| `@visulima/package/pnpm`            | `readPnpmCatalogs[Sync]`, `resolveCatalogReference[s]`, `resolveDependenciesCatalogReferences`, `isPackageInWorkspace`                                    |
| `@visulima/package/error`           | `PackageNotFoundError`                                                                                                                                    |

```typescript
import { parseLockFile } from "@visulima/package/lockfile";
import { readPnpmCatalogs } from "@visulima/package/pnpm";
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## About

### Related Projects

- [read-pkg](https://github.com/sindresorhus/read-pkg) - Read a package.json file.

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima package is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/package?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/package?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/package
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
