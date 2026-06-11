<div align="center">
  <h3>Visulima task-runner-client</h3>
  <p>
  Give the <a href="https://visulima.com/packages/task-runner">@visulima/task-runner</a> precise cache-correctness hints from inside a task — and a graceful no-op everywhere else.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

---

## Why

`@visulima/task-runner` infers a task's cache inputs and outputs by **observing** it — watching file syscalls (seccomp/strace on Linux) and resolving env patterns declared in config. That works on unmodified tools, but it can't know three things only the tool itself knows:

- which reads are **noise** (a tool-private cache like `node_modules/.cache/eslint`) rather than real inputs,
- which writes are **scratch** rather than real build outputs,
- when a run is **non-deterministic** and shouldn't be cached at all,
- and which **env vars** it consumes deep inside, beyond the runner's configured patterns.

This package lets a tool _tell_ the runner. It's a thin, **zero-dependency** wrapper: each call appends one line to a per-task file the runner exposes via the `TASK_RUNNER_HINTS` environment variable. Outside a runner-managed task that variable is absent, so **every call is a graceful no-op** — safe to ship in a tool used both standalone and under the runner.

## Install

```sh
npm install @visulima/task-runner-client
```

## Usage

```ts
import { disableCache, getEnv, getEnvs, ignoreInput, ignoreOutput, isManaged, trackInput, trackOutput, trackValue } from "@visulima/task-runner-client";

// Don't let our own cache directory count as a cache input.
ignoreInput("node_modules/.cache/my-tool");

// Don't let a scratch file count as a build output.
ignoreOutput(".my-tool-tmp");

// Positive hints: tell the runner about inputs/outputs the tracer can't see
// (e.g. a file read by an untracked grandchild process).
trackInput("vendor/generated.lock");
trackOutput("dist/sourcemap.json");

// Custom cache-key input the tracer can never observe (DB schema rev,
// remote API version, a runtime-computed flag).
trackValue("db-schema", await getSchemaRevision());

// Read an env var AND register it as a cache dependency in one call —
// a change to its value will invalidate this task's cache entry.
const apiUrl = getEnv("MY_API_URL");

// Same, glob-matched: every VITE_* var becomes a cache dependency.
const viteEnv = getEnvs("VITE_*");

if (somethingNonDeterministicHappened) {
    // Skip caching this run entirely (with an optional reason for the summary).
    disableCache("upstream API returned a 5xx");
}

// Pay nothing for expensive hint computation when run standalone.
if (isManaged()) {
    for (const file of computeManyIgnorePaths()) {
        ignoreInput(file);
    }
}
```

## API

| Function                         | Effect                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ignoreInput(path)`              | Drop reads under `path` from this run's inferred cache inputs.                                                                |
| `ignoreOutput(path)`             | Drop writes under `path` from this run's inferred cache outputs.                                                              |
| `trackInput(path)`               | Add `path` as a cache input even if the tracer didn't observe the read.                                                       |
| `trackOutput(path)`              | Add `path` as a cache output even if the tracer didn't observe the write.                                                     |
| `trackValue(key, value)`         | Add an arbitrary `key`/`value` pair to the cache key — for non-file, non-env determinism inputs.                              |
| `disableCache(reason?)`          | Mark this run non-deterministic — the runner won't cache it. Optional `reason` surfaces in the run summary.                   |
| `getEnv(name, { tracked? })`     | Return `process.env[name]`; with `tracked` (default `true`) register `name` as a cache dependency.                            |
| `getEnvs(pattern, { tracked? })` | Return every env matching the `*`-glob `pattern`; with `tracked` (default `true`) register the pattern as a cache dependency. |
| `isManaged()`                    | `true` when running inside a runner-managed task. Gate expensive hint computation on it.                                      |
| `getProtocolVersion()`           | The runner's advertised wire-protocol version, or `undefined` outside a runner.                                               |

Also exported: `HINTS_ENV` / `PROTOCOL_ENV` (the wire-contract env-var names), `SUPPORTED_PROTOCOL_VERSION`, and the `TrackOptions` type.

Relative paths are resolved to absolute form against the **current** working directory at the moment of the call — so a tool that calls `process.chdir()` before hinting still gets the root it means. `getEnv`/`getEnvs` always return values; only the dependency registration is gated on running inside a runner. Pass `{ tracked: false }` to read without registering a dependency.

This mirrors the API of [`@voidzero-dev/vite-task-client`](https://github.com/voidzero-dev/vite-task/tree/main/packages/vite-task-client), so tools written against that client work under `@visulima/task-runner` unchanged.

## Adopting tools written for vite-task

A tool that already imports `@voidzero-dev/vite-task-client` emits **no hints under this runner** — that client only talks to vite+'s proprietary addon, which isn't present here, so every call no-ops. Because our API is a drop-in match, you can alias the dependency so those calls reach _our_ runner instead, without touching the tool's source.

**pnpm** (`pnpm-workspace.yaml` or `package.json`):

```yaml
overrides:
    "@voidzero-dev/vite-task-client": "npm:@visulima/task-runner-client@^1"
```

**npm / Bun** (`package.json`):

```json
{
    "overrides": {
        "@voidzero-dev/vite-task-client": "npm:@visulima/task-runner-client@^1"
    }
}
```

**Yarn** (`package.json`):

```json
{
    "resolutions": {
        "@voidzero-dev/vite-task-client": "npm:@visulima/task-runner-client@^1"
    }
}
```

The tool keeps `import { getEnv } from "@voidzero-dev/vite-task-client"`; the resolver loads our package, which reads `TASK_RUNNER_HINTS` and feeds the runner. Under vite+ (where `TASK_RUNNER_HINTS` is unset) our package no-ops, so the override is safe even in mixed setups.

> Using [`@visulima/vis`](https://www.npmjs.com/package/@visulima/vis)? `vis run` detects `@voidzero-dev/vite-task-client` in your workspace and offers to add this override for you (interactive TTY only; it remembers a "no" and never prompts in CI).

## License

The visulima task-runner-client is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/task-runner-client?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/task-runner-client/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/task-runner-client/v/latest "npm"
