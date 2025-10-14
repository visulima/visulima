<div align="center">
  <h3>Visulima package</h3>
  <p>
  A comprehensive package management utility that helps you find root directories, monorepos, package managers, and parse package.json, package.yaml, and package.json5 files with advanced features like catalog resolution, customizable file discovery order, and caching.

Built on top of

[@visulima/fs](https://github.com/visulima/visulima/tree/main/packages/fs),
[@visulima/path](https://github.com/visulima/visulima/tree/main/packages/path),
[normalize-package-data](https://github.com/npm/normalize-package-data),
[pathe](https://github.com/unjs/pathe), and
[type-fest](https://github.com/sindresorhus/type-fest)

  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

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

**File Search Priority**: The function searches for files in the following order by default:

1. `package.yaml` (highest priority)
2. `package.json5`
3. `package.json` (lowest priority)

You can customize the search order using the `fileOrder` option:

```typescript
// Custom order: json5 → yaml → json
const result = await findPackageJson("/path/to/project", {
    fileOrder: ["json5", "yaml", "json"]
});

// Disable yaml, use json5 → json order
const result = await findPackageJson("/path/to/project", {
    yaml: false,
    fileOrder: ["json5", "json"]
});
```

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

// With format control, custom file order, and caching options
const packageJson = await parsePackageJson("./package.yaml", {
    yaml: true, // Enable package.yaml support (default: true)
    json5: false, // Disable package.json5 support (default: true)
    fileOrder: ["json5", "yaml", "json"], // Custom file search order
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

**File Discovery Order**: When searching for package files (not when parsing a specific file), the default order is:

1. `package.yaml` (highest priority)
2. `package.json5`
3. `package.json` (lowest priority)

You can customize this order using the `fileOrder` option:

```typescript
// Custom search order: json → yaml → json5
const result = await parsePackageJson("/path/to/project", {
    fileOrder: ["json", "yaml", "json5"]
});

// Disable yaml, search json5 → json only
const result = await parsePackageJson("/path/to/project", {
    yaml: false,
    fileOrder: ["json5", "json"]
});
```

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

## License

The visulima package is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/package?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/package/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/package/v/latest "npm"
