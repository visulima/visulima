<div align="center">
  <h3>Visulima task-runner</h3>
  <p>
  High-performance monorepo task runner with intelligent caching, dependency-aware scheduling, and auto-fingerprinting.
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

## Features

- **Two caching modes**: Nx-style explicit inputs or Vite Task-style auto-fingerprinting
- **Smart lockfile hashing**: Only hashes resolved versions relevant to each package (like Turborepo)
- **Framework env inference**: Auto-detects Next.js, Vite, CRA, Gatsby, Nuxt, and more
- **Remote caching**: Turborepo-compatible HTTP cache protocol
- **Native Rust addon**: Optional xxHash-based parallel file hashing via napi-rs
- **Dependency-aware scheduling**: Topological task ordering with priority-based batching
- **Incremental file hashing**: mtime-based change detection for near-instant cache checks
- **Affected detection**: Git diff-based filtering to only run tasks for changed packages
- **Graph visualization**: DOT, JSON, HTML, and ASCII output formats
- **Run summaries**: Detailed JSON reports for debugging cache behavior
- **Cache diagnostics**: Explains exactly why a cache miss occurred
- **Output archiving**: Caches and restores build outputs (dist/ directories)
- **LRU cache eviction**: Configurable max size and age limits
- **Lifecycle hooks**: 7 hook points for custom behavior

## Install

```bash
npm install @visulima/task-runner
```

```bash
yarn add @visulima/task-runner
```

```bash
pnpm add @visulima/task-runner
```

## Quick Start

```typescript
import { defaultTaskRunner, createTaskGraph } from "@visulima/task-runner";

const results = await defaultTaskRunner(tasks, {
    // Nx-style: explicit inputs
    namedInputs: {
        production: ["{projectRoot}/src/**/*"],
    },
    globalInputs: ["pnpm-lock.yaml", "tsconfig.base.json"],
    globalEnv: ["NODE_ENV"],

    // Or: auto-fingerprinting (Vite Task-style)
    // autoFingerprint: true,

    // Smart lockfile hashing (only bust cache for affected packages)
    smartLockfileHashing: true,

    // Auto-detect framework env vars (NEXT_PUBLIC_*, VITE_*, etc.)
    frameworkInference: true,

    // Remote cache (Turborepo-compatible)
    remoteCache: {
        url: "https://cache.example.com",
        token: process.env.CACHE_TOKEN,
        teamId: "my-team",
    },
}, context);
```

## Caching Modes

### Nx-style (explicit inputs)

Declare which files, env vars, and runtime values should be included in the cache hash:

```typescript
const results = await defaultTaskRunner(tasks, {
    namedInputs: {
        production: [
            "{projectRoot}/src/**/*",
            { env: "NODE_ENV" },
            { runtime: "node --version" },
        ],
    },
    targetDefaults: {
        build: { inputs: ["production"] },
        test: { inputs: ["production", "{projectRoot}/**/*.test.ts"] },
    },
}, context);
```

### Auto-fingerprint (Vite Task-style)

Automatically tracks which files a task accesses during execution:

```typescript
const results = await defaultTaskRunner(tasks, {
    autoFingerprint: true,
    fingerprintEnvPatterns: ["VITE_*", "NODE_ENV"],
    cacheDiagnostics: true, // Shows why cache misses occur
}, context);
```

## API

### `defaultTaskRunner(tasks, options, context)`

The main entry point. Runs tasks with caching, scheduling, and lifecycle support.

### Key Options

| Option | Type | Description |
|--------|------|-------------|
| `parallel` | `number \| boolean` | Max parallel tasks (default: 3) |
| `smartLockfileHashing` | `boolean` | Hash only relevant lockfile entries per package |
| `frameworkInference` | `boolean` | Auto-detect framework env var prefixes |
| `autoFingerprint` | `boolean` | Enable Vite Task-style auto-fingerprinting |
| `globalInputs` | `string[]` | Files that invalidate all caches when changed |
| `globalEnv` | `string[]` | Env vars that invalidate all caches |
| `remoteCache` | `object` | Remote cache server configuration |
| `dryRun` | `boolean` | Compute hashes without executing |
| `summarize` | `boolean` | Generate JSON run summary |
| `cacheDiagnostics` | `boolean` | Log cache miss reasons |
| `maxCacheSize` | `string` | Max cache size (e.g., "1GB") |
| `maxCacheAge` | `number` | Max cache entry age in ms |

### Exports

The package exports many building blocks for custom task runners:

- **Task Graph**: `createTaskGraph`, `findCycle`, `walkTaskGraph`, `makeAcyclic`
- **Hashing**: `InProcessTaskHasher`, `IncrementalFileHasher`, `computeTaskHash`
- **Caching**: `Cache`, `RemoteCache`, `FingerprintManager`
- **Scheduling**: `TaskScheduler`, `TaskOrchestrator`
- **Lockfile**: `LockfileHasher`, `parseNpmLockfile`, `parsePnpmLockfile`, `parseYarnLockfile`
- **Framework**: `detectFrameworks`, `inferFrameworkEnvPatterns`, `getFrameworkEnvVars`
- **Affected**: `getAffectedProjects`, `getChangedFiles`, `filterAffectedTasks`
- **Visualization**: `toGraphvizDot`, `toGraphJson`, `toGraphHtml`, `toGraphAscii`
- **Summary**: `generateRunSummary`, `writeRunSummary`
- **Lifecycle**: `ConsoleLifeCycle`, `CompositeLifeCycle`

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

## License

The visulima task-runner is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/task-runner?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md
[npm-image]: https://img.shields.io/npm/v/@visulima/task-runner/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/task-runner/v/latest
