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

- **Concurrent process runner**: Run multiple commands in parallel with native Rust performance (NAPI bindings) and JS fallback
- **Process tree management**: Proper cleanup via setsid/killpg (Unix) and Job Objects (Windows)
- **Command parser pipeline**: `npm:build` shortcuts, `npm run watch-*` wildcard expansion, `{1}` argument placeholders
- **Flow controllers**: Restart with backoff, stdin routing, timing summaries, teardown commands
- **npm script-shell support**: Honors `npm config set script-shell` for custom shells (Git Bash, etc.)
- **Long-running process support**: Configurable stdin mode (null/pipe/inherit), bounded output buffers
- **Two caching modes**: Nx-style explicit inputs or Vite Task-style auto-fingerprinting
- **3-tier auto-fingerprint dispatch on Linux**: kernel-level `seccomp_unotify` (catches Alpine/musl/static-binary children), `strace` fallback, then no-op. The seccomp path uses a tiny `fspy-seccomp-helper` binary bundled with the platform binding package — sidesteps the fork-from-multithreaded hazard of installing seccomp in `pre_exec` from Node's NAPI host. See `rfc/design-fspy-seccomp-unotify.md`.
- **Smart lockfile hashing**: Only hashes resolved versions relevant to each package (like Turborepo). Supports `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and `bun.lock` (Bun >= 1.2)
- **Framework env inference**: Auto-detects Next.js, Vite, CRA, Gatsby, Nuxt, and more
- **Remote caching**: Turborepo-compatible HTTP cache protocol, plus a Bazel REAPI gRPC backend (bazel-remote, BuildBuddy, BuildBarn, EngFlow)
- **Native Rust addon**: Parallel file hashing (xxHash), concurrent process management via tokio
- **Dependency-aware scheduling**: Topological task ordering with priority-based batching
- **Incremental file hashing**: mtime-based change detection for near-instant cache checks
- **Affected detection**: Git diff-based filtering to only run tasks for changed packages
- **Conditional tasks**: `when:` predicates (`os`, `env`, `branch`, `ci`) and `always: true` finally-tasks for cleanup/notifications
- **Graph visualization**: DOT, JSON, HTML, and ASCII output formats
- **Log reporter modes**: `interleaved`, `labeled` (per-line `[project#target]` prefix), and `grouped` (header/footer wrapping) for vite-task parity
- **Run summaries**: Detailed JSON reports for debugging cache behavior
- **Cache diagnostics**: Explains exactly why a cache miss occurred
- **Output archiving**: Caches and restores build outputs (dist/ directories)
- **LRU cache eviction**: Configurable max size and age limits
- **Lifecycle hooks**: 7 hook points for custom behavior
- **Cooperative cache hints**: tools can refine the inferred fingerprint from the inside via the zero-dependency [`@visulima/task-runner-client`](../task-runner-client) — `ignoreInput`/`ignoreOutput` to drop noise, `disableCache` for non-deterministic runs, and `getEnv`/`getEnvs` to register env-var dependencies at the point of use (closing the silent under-tracking gap that pattern-only env config leaves open). Complements observation: works on every platform, no client = no change.

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
import { defaultTaskRunner } from "@visulima/task-runner";

const results = await defaultTaskRunner(
    tasks,
    {
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
    },
    context,
);
```

## Concurrent Process Runner

Run multiple commands in parallel with real-time output streaming, process tree management, and automatic native acceleration.

```typescript
import { runConcurrently } from "@visulima/task-runner";

// Basic usage
const result = await runConcurrently(["npm run build", "npm run test", "npm run lint"]);
console.log(result.success ? "All passed" : "Some failed");

// With options
const result = await runConcurrently(
    [
        { command: "vite dev", name: "web", stdin: "inherit" },
        { command: "node api.js", name: "api" },
    ],
    {
        maxProcesses: 4,
        killOthers: ["failure"], // Kill all if one fails
        successCondition: "all", // All must exit 0
        onEvent: (event) => {
            // Real-time streaming
            if (event.kind === "stdout") {
                console.log(`[${event.index}] ${event.text}`);
            }
        },
    },
);
```

### Command Parser

Use `parseCommands` to expand shortcuts and wildcards before passing to `runConcurrently`:

```typescript
import { parseCommands, runConcurrently } from "@visulima/task-runner";

const commands = parseCommands([
    "npm:build", // -> npm run build
    "pnpm:test", // -> pnpm run test
    '"quoted command"', // -> quoted command (quotes stripped)
    "npm run watch-*", // -> expands to all matching scripts in package.json
    "deno task dev-*", // -> expands from deno.json/deno.jsonc tasks
]);

await runConcurrently(commands);
```

### Flow Controllers

```typescript
import { runConcurrently } from "@visulima/task-runner";

// Restart failed commands with exponential backoff
await runConcurrently(["flaky-command"], {
    restart: { tries: 3, delay: "exponential" },
});

// Print timing summary after completion
await runConcurrently(["npm run build", "npm run test"], {
    timings: true,
});

// Run cleanup commands after all processes finish
await runConcurrently(["npm run dev"], {
    teardown: ["docker compose down", "rm -rf .cache"],
});
```

### Shell Configuration

The runner automatically detects `npm config set script-shell` for custom shells (e.g., Git Bash on Windows):

```typescript
import { runConcurrently, detectScriptShell } from "@visulima/task-runner";

// Auto-detected from npm config
await runConcurrently(["echo hello"]);

// Or override explicitly
await runConcurrently(["echo hello"], {
    shellPath: "/usr/bin/bash",
});
```

### Stdin Modes

For long-running processes like dev servers:

```typescript
await runConcurrently([
    { command: "vite dev", stdin: "inherit" }, // Child reads terminal directly
    { command: "node worker.js", stdin: "null" }, // No stdin (default)
    { command: "node repl.js", stdin: "pipe" }, // Programmatic stdin access
]);
```

### Native vs Fallback

The runner automatically uses the Rust NAPI addon when available for:

- Process tree killing via setsid/killpg (Unix) and Job Objects (Windows)
- Async I/O multiplexing via tokio
- Signal propagation (SIGINT/SIGTERM/SIGHUP)

Falls back to a pure JavaScript implementation when the native addon is not compiled.

## Caching Modes

### Nx-style (explicit inputs)

Declare which files, env vars, and runtime values should be included in the cache hash:

```typescript
const results = await defaultTaskRunner(
    tasks,
    {
        namedInputs: {
            production: ["{projectRoot}/src/**/*", { env: "NODE_ENV" }, { runtime: "node --version" }],
        },
        targetDefaults: {
            build: { inputs: ["production"] },
            test: { inputs: ["production", "{projectRoot}/**/*.test.ts"] },
        },
    },
    context,
);
```

### Auto-fingerprint (Vite Task-style)

Automatically tracks which files a task accesses during execution:

```typescript
const results = await defaultTaskRunner(
    tasks,
    {
        autoFingerprint: true,
        fingerprintEnvPatterns: ["VITE_*", "NODE_ENV"],
        cacheDiagnostics: true, // Shows why cache misses occur
    },
    context,
);
```

## API

> Looking for the full reference? The [`docs/`](./docs) folder holds the long-form guides — [`docs/api.mdx`](./docs/api.mdx) (API), [`docs/configuration.mdx`](./docs/configuration.mdx) (config), [`docs/installation.mdx`](./docs/installation.mdx), plus [`docs/concepts`](./docs/concepts) and [`docs/guides`](./docs/guides). The section below is a quick overview.

### Subpath exports (lighter imports)

The barrel (`@visulima/task-runner`) pulls in the cache, CAS, graph, scheduler, and remote-backend code. If you only need a slice, import a subpath so the rest can be tree-shaken / never loaded at require time:

| Subpath                            | What it exports                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@visulima/task-runner/concurrent` | The lightweight concurrent runner (`runConcurrently`, command parser, flow controllers, log reporter) — a `concurrently` / vite-task replacement |
| `@visulima/task-runner/cache`      | Local cache façade (`Cache`, size helpers) + CAS primitives (`digestFile`, blob store, v2 paths)                                                 |
| `@visulima/task-runner/graph`      | Task-graph construction, traversal utilities, and graph visualization                                                                            |

```ts
import { runConcurrently } from "@visulima/task-runner/concurrent";
```

### `defaultTaskRunner(tasks, options, context)`

The main entry point. Runs tasks with caching, scheduling, and lifecycle support.

### `runConcurrently(commands, options?)`

Run commands concurrently with process management and output streaming.

| Option             | Type                         | Description                                         |
| ------------------ | ---------------------------- | --------------------------------------------------- |
| `maxProcesses`     | `number`                     | Max simultaneous processes (0 = unlimited)          |
| `killOthers`       | `("failure" \| "success")[]` | Kill others when a process exits                    |
| `killSignal`       | `string`                     | Signal for killing (default: "SIGTERM")             |
| `killTimeout`      | `number`                     | Ms before SIGKILL after kill signal (default: 5000) |
| `successCondition` | `string`                     | "all", "first", "last", "command-\<name\>"          |
| `shellPath`        | `string`                     | Custom shell path (auto-detected from npm config)   |
| `restart`          | `{ tries, delay }`           | Restart failed commands with backoff                |
| `teardown`         | `string[]`                   | Cleanup commands to run after completion            |
| `timings`          | `boolean`                    | Print timing summary table                          |
| `onEvent`          | `(event) => void`            | Real-time stdout/stderr/close/error events          |

### Key Options

| Option                 | Type                | Description                                     |
| ---------------------- | ------------------- | ----------------------------------------------- |
| `parallel`             | `number \| boolean` | Max parallel tasks (default: 3)                 |
| `smartLockfileHashing` | `boolean`           | Hash only relevant lockfile entries per package |
| `frameworkInference`   | `boolean`           | Auto-detect framework env var prefixes          |
| `autoFingerprint`      | `boolean`           | Enable Vite Task-style auto-fingerprinting      |
| `globalInputs`         | `string[]`          | Files that invalidate all caches when changed   |
| `globalEnv`            | `string[]`          | Env vars that invalidate all caches             |
| `remoteCache`          | `object`            | Remote cache server configuration               |
| `dryRun`               | `boolean`           | Compute hashes without executing                |
| `summarize`            | `boolean`           | Generate JSON run summary                       |
| `cacheDiagnostics`     | `boolean`           | Log cache miss reasons                          |
| `maxCacheSize`         | `string`            | Max cache size (e.g., "1GB")                    |
| `maxCacheAge`          | `number`            | Max cache entry age in ms                       |

### Remote cache (`remoteCache` / `RemoteCacheOptions`)

Two backends are selected by `mode`: an HTTP backend that speaks the Turborepo `/v8/artifacts` wire protocol, and a Bazel **REAPI** gRPC backend.

| Field          | Type                                          | Default       | Description                                                              |
| -------------- | --------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `url`          | `string`                                      | —             | Cache server base URL.                                                   |
| `token`        | `string`                                      | —             | Bearer token sent on every request.                                     |
| `teamId`       | `string`                                      | —             | Turborepo team/slug scoping.                                             |
| `mode`         | `"read" \| "write" \| "readwrite"`            | `"readwrite"` | Read-only, write-only, or both.                                         |
| `compression`  | `"gzip" \| "none"`                            | `"gzip"`      | HTTP tarball compression.                                               |
| `timeout`      | `number`                                      | `30000`       | Per-request timeout in ms.                                              |
| `signing`      | `{ secret; verifyOnDownload? }`               | —             | HMAC-SHA256 artifact signing (see below).                              |
| `attestation`  | `{ verifyArtifact?; requireOnDownload?; ... }`| —             | Keyless (Sigstore-style) attestation hooks layered above signing.       |

#### Signing (`signing`)

When `signing.secret` is set (must be ≥ 16 chars), every upload carries an `X-Artifact-Signature` HMAC of `hash | body`, and **downloads are verified by default** (`verifyOnDownload` defaults to `true`). This is intentional: configuring a secret signals you want artifacts authenticated, so a cache server or MITM that strips the signature header cannot have unsigned artifacts extracted into your workspace (cache poisoning → arbitrary code execution in builds). Set `verifyOnDownload: false` only during a migration where some uploads aren't signed yet.

#### REAPI backend requires `@grpc/grpc-js`

The Bazel REAPI gRPC backend (`ReapiRemoteCache`) imports `@grpc/grpc-js` and `@grpc/proto-loader` lazily — they are **optional peer dependencies**. Install them yourself when using REAPI:

```sh
npm install @grpc/grpc-js @grpc/proto-loader
```

The HTTP backend has no such requirement.

### Exports

The package exports many building blocks for custom task runners:

- **Concurrent Runner**: `runConcurrently`, `runConcurrentFallback`, `detectScriptShell`
- **Command Parser**: `parseCommands`, `expandShortcut`, `expandWildcard`, `expandArguments`, `stripQuotes`
- **Flow Controllers**: `withRestart`, `createInputHandler`, `logTimings`, `formatTimingTable`, `runTeardown`
- **Task Graph**: `createTaskGraph`, `findCycle`, `walkTaskGraph`, `makeAcyclic`
- **Hashing**: `InProcessTaskHasher`, `IncrementalFileHasher`, `computeTaskHash`
- **Caching**: `Cache`, `FingerprintManager`, `createRemoteCacheBackend`, `HttpRemoteCache`, `ReapiRemoteCache`
- **Scheduling**: `TaskScheduler`, `TaskOrchestrator`
- **Lockfile**: `LockfileHasher`, `parseNpmLockfile`, `parsePnpmLockfile`, `parseYarnLockfile`, `parseBunLockfile`
- **Framework**: `detectFrameworks`, `inferFrameworkEnvPatterns`, `getFrameworkEnvVariables`
- **Affected**: `getAffectedProjects`, `getChangedFiles`, `filterAffectedTasks`
- **Visualization**: `toGraphvizDot`, `toGraphJson`, `toGraphHtml`, `toGraphAscii`
- **Summary**: `generateRunSummary`, `writeRunSummary`
- **Lifecycle**: `ConsoleLifeCycle`, `CompositeLifeCycle`

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md) guidelines.

## License

The visulima task-runner is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
[license-image]: https://img.shields.io/npm/l/@visulima/task-runner?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md
[npm-image]: https://img.shields.io/npm/v/@visulima/task-runner/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/task-runner/v/latest
