# Design — Package-level + extends config layering (roadmap #9)

Spec for adding (a) an `extends:` chain to root `vis.config.ts` and (b) a per-package `vis.task.ts` overlay file. Goal: explicit, predictable merge semantics that no competitor ships cleanly (wireit#66, moon#2113/#2164, lage#163/#816/#817).

## Why

Two distinct user pains, one design:

1. **Sharing config across repos / monorepos.** Today a root `vis.config.ts` is a single file. Teams running multiple monorepos want to extract a shared baseline (`@acme/vis-preset`) and consume it from `extends`, the way `tsconfig.json`, `eslint.config.js`, and `nx.json` already let them.
2. **Per-package overrides without project.json bloat.** Today, package-local target overrides live in `project.json` as JSON. That works for static fields but is awkward for anything dynamic (tokens, conditional `when`, `inputs` derived from the framework). A `.ts` file per package — with full type-safety from `defineTaskConfig({...})` — is the natural surface.

We're not removing project.json. project.json stays the canonical _static_ metadata file (tags, layer, stack, owners — used by query/scope predicates). `vis.task.ts` is the canonical _target-config_ overlay, opt-in.

## Current state

| Layer                         | File                                                                                                                 | Type | Today       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| Workspace defaults (flat)     | `vis.config.ts` → `targetDefaults: Record<string, Partial<VisTargetConfiguration>>`                                  | TS   | exists      |
| Workspace defaults (scoped)   | `vis.config.ts` → `taskDefaults: TaskDefaultsBlock[]`                                                                | TS   | exists      |
| Workspace `extends`           | —                                                                                                                    | —    | **missing** |
| Project metadata              | `project.json` → `tags`, `layer`, `stack`, `language`, `owners`, `projectType`, `sourceRoot`, `implicitDependencies` | JSON | exists      |
| Project targets (declarative) | `project.json` → `targets: Record<string, VisTargetConfiguration>`                                                   | JSON | exists      |
| Project targets (overlay TS)  | `vis.task.ts`                                                                                                        | TS   | **missing** |
| Auto-derived targets          | `package.json` scripts                                                                                               | JSON | exists      |

The current merge happens in `workspace.ts` `mergeTarget()` (lines 1057–1088):

```
defaults  →  projectTarget (project.json)  →  scriptCommand (fills empty .command)  →  preset  →  defaultCacheForType
```

`defaults` itself is the result of `collectTargetDefaults()`: `targetDefaults` flat map first, then matching `taskDefaults` blocks in declaration order. Object-shallow merge throughout (`{ ...a, ...b }`) — array fields **replace**.

## Proposed surface

### A. `extends:` in `vis.config.ts`

```ts
// vis.config.ts
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    extends: [
        "@acme/vis-preset", // npm package — resolved via Node.js require.resolve
        "./shared/vis-security.config.ts", // path relative to this file
    ],
    security: { allowBuilds: { esbuild: true } },
});
```

**Resolution:**

- Strings starting with `./` or `../` → file path relative to the file declaring `extends`.
- Strings without a leading `.` → `require.resolve(name, { paths: [<containing-dir>] })`. Package may export `vis.config.ts` directly or a JS module that default-exports a `VisConfig`.
- Each entry is loaded the same way as the root config (jiti for TS), recursively (extends-of-extends).

**Order:** `extends` is an array, processed left-to-right. Later entries override earlier ones. The current-file values override everything in `extends`. Mental model: `extends` is "things I'm built on top of, in the order I'd apply them as a stack."

### B. `vis.task.ts` per package

```ts
// packages/api/crud/vis.task.ts
import { defineTaskConfig } from "@visulima/vis/config";

export default defineTaskConfig({
    targets: {
        build: {
            inputs: ["src/**/*", "{workspaceRoot}/tsconfig.base.json"],
            outputs: ["dist/**/*"],
            options: { persistent: false },
        },
        test: {
            when: { not: { ci: true } }, // skip locally on CI
            dependsOn: [{ dependencies: true, target: "build" }],
        },
    },
});
```

Discovery: `discoverWorkspace()` already iterates `projectDirectories`. For each project dir, after reading `project.json`, also probe for `vis-task.{ts,mts,cts,js,mjs,cjs}` (same priority order as root config). If found, load it and treat its `targets` as a higher-priority overlay than `project.json.targets`.

Note: only `targets:` is exposed at this layer. **Not** `tags`/`layer`/`stack`/`language` — those stay in project.json so static query/scope predicates don't have to execute TS to know what a project is.

### C. New helper: `defineTaskConfig`

Identity helper, mirrors `defineConfig`. Returns the input untouched. Exists purely for autocomplete:

```ts
const defineTaskConfig = (config: VisTaskConfig): VisTaskConfig => config;
```

`VisTaskConfig` is the narrow shape: `{ targets: Record<string, VisTargetConfiguration> }`. Extensible later if we surface other per-package surfaces (e.g., `fileGroups` scoped to one project).

## Merge precedence

Final order, lowest to highest priority (later overrides earlier):

1. **`extends` chain** — flattened depth-first, left-to-right. Each extended config's `targetDefaults`/`taskDefaults`/`fileGroups`/`taskGroups` merge into the consumer.
2. **Root `vis.config.ts`** values — non-extends fields.
3. **`taskDefaults` blocks** — matching scopes, in declaration order. Already implemented.
4. **`project.json` targets** — per-project static targets.
5. **`vis.task.ts` targets** — per-project TS overlay. **(NEW)**
6. **`package.json` scripts** — fill `command` only when it's still undefined after all of the above.
7. **Preset** — applied last to the merged target.
8. **`defaultCacheForType`** — fills `cache` if still undefined.

Note step 6 is unchanged: scripts are a _fallback_ command source, never an override. A user explicitly setting `command: "tsc -b"` in vis.task.ts wins over `"build": "tsc -b"` in package.json.

## Array fields — concat vs replace

**Decision: replace by default; opt-in concat via `[...]` in TS or sentinel marker `"@inherit"` in JSON.**

Replace-by-default keeps the mental model simple ("later wins, period") and matches what `Object.assign`/spread already does. But array fields like `dependsOn`, `inputs`, `outputs`, `tags` legitimately want extension in real cases.

In TS files (`vis.config.ts`, `vis.task.ts`) users already have full programmatic control — they can spread the inherited array if they want:

```ts
// vis.task.ts — extending a default
export default defineTaskConfig({
    targets: {
        build: {
            // Concat: pick up workspace-level inputs + add my own
            inputs: ["@inherit", "src/proto/**/*.proto"],
        },
        test: {
            // Replace: I want none of the inherited deps
            dependsOn: [],
        },
    },
});
```

The `"@inherit"` sentinel is the explicit opt-in marker. `mergeTarget` scans the array for it; if present, the position is replaced inline by the inherited array's values (preserving order around it). If absent, the array replaces wholesale.

Why a sentinel and not a function/`extend()` helper:

- Works identically in JSON (project.json) and TS files.
- One marker, one rule — no special-casing per field.
- Survives JSON-stringify round-trips (matters for cache, schema, debug output).

Sentinel chosen: `"@inherit"` — the `@` prefix matches our existing namespace convention for non-literal strings (`@filegroup:foo`, `@workspace`).

**Affected fields:** `dependsOn`, `inputs`, `outputs`, `tags`, `env`, `passThroughEnv`, plus anything else that's a `string[]` or `(string | object)[]` shape. The merge helper applies uniformly to all array fields — no per-field allowlist.

## Cycle detection

Cycles can appear in two places:

1. **`extends` chain** — `A extends B extends A`.
2. **`taskGroups`** — already handled; cycles raise during discovery.

For (1): track visited absolute paths during `loadVisConfig`. If a path is re-entered during its own descent, throw `VisConfigCycleError(path, chain)` with the full cycle. Re-entering a path that has already _finished_ loading is fine — that's a diamond, not a cycle.

Implementation hint: pass a `Set<string>` (visited-on-current-stack) plus a `Map<string, VisConfig>` (already-loaded cache) into the recursive loader. Same pattern as the existing `taskGroups` cycle check.

## Error reporting

Three distinct error classes worth distinguishing:

| Class                    | Trigger                     | Message                                                                                                                |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `VisConfigNotFoundError` | `extends: ["./missing.ts"]` | `Cannot resolve "./missing.ts" extended from <root>/vis.config.ts. Tried: <abs>`                                       |
| `VisConfigCycleError`    | A→B→A                       | `Config cycle: <root>/vis.config.ts → ./shared.ts → ./shared.ts (re-enters)`                                           |
| `VisConfigLoadError`     | jiti throws                 | wraps with the source file path so a syntax error in `vis.task.ts` doesn't surface as "TypeError in workspace.ts:1208" |

All three should print the **chain of files** that led there, not just the failing file. Users with deep extends chains will hit this and "your shared preset broke" with no path is the worst possible failure mode.

## Caching impact

Today `loadVisConfig` caches by `sha256(vis.config.ts content)`. With extends + per-package files, the cache key has to cover the whole loaded set, otherwise editing `./shared.ts` won't invalidate.

**Proposal:** the cache key becomes `sha256(sorted(absolute_path + ":" + sha256(content) for each loaded file))`. Cheap (paths are bounded; we already read each file). Keeps the existing `vis-config-cache.json` location.

Per-package `vis.task.ts` files: a separate, per-project cache entry under the same `node_modules/.cache/vis/` directory, keyed by `<project-name>:<sha256 of vis.task.ts>`. Keeps invalidation localized — editing one package's vis.task.ts doesn't invalidate the root config cache.

## Migration path

- **No deprecation of `project.json`.** project.json keeps `targets`. Users who like JSON keep using it.
- **No deprecation of `targetDefaults` / `taskDefaults`.** Both stay.
- `vis.task.ts` is **purely additive**. A package without one behaves identically to today.
- `extends` is **purely additive**. A config without it behaves identically.

The migrators (turborepo, nx, moon) already write `vis.config.ts` + `project.json`. No changes needed for inbound. For the outbound migrator (item #10), we'll need to _consume_ `extends` chains by inlining (turbo doesn't have extends) or by emitting their own analogue (nx has extends in nx.json, moon has `.moon/workspace.yml` extends).

## Implementation outline

In rough order; each chunk should land as its own commit.

1. **Schema** — extend `project.schema.json` with `vis.task.ts`'s target shape (already covered by `targetConfiguration` `$def`); no JSON-schema change needed for `extends:` since `vis.config.ts` is TS-only.
2. **Loader** — refactor `config.ts:loadVisConfig` into a recursive `loadConfigFile(path, visited, cache)` that returns `{ config, loadedFiles: string[] }`. The top-level `loadVisConfig` deep-merges along the resolved chain.
3. **Per-package loader** — new `loadVisTaskConfig(projectDir): Promise<VisTaskConfig | undefined>` in `config.ts`. Same jiti reuse, same sha256 cache.
4. **Discovery integration** — in `workspace.ts:discoverWorkspace`, after reading `project.json`, also load `vis.task.ts` if present. Merge its `targets` over `projectJson.targets` before the existing `mergeTarget` flow runs.
5. **`@inherit` sentinel** — new helper `mergeArrayWithInherit(parent: T[] | undefined, child: T[] | undefined): T[]`. Replace every array-merge site in `mergeTarget` (and in `collectTargetDefaults`) with it.
6. **Errors** — three new error classes in `src/errors/config-errors.ts`. Wrap jiti throws.
7. **Tests** — fixture-based: `__tests__/extends-chain.test.ts` (cycles, diamonds, npm-resolved), `__tests__/vis-task-overlay.test.ts` (project-level merge precedence, `@inherit`).
8. **Docs** — new section in `docs/configuration.mdx` (after existing `targetDefaults` section): "Layered configuration: extends + vis.task.ts".

## Decisions

1. **Filename:** `vis.task.ts` — matches the dot-style convention of `eslint.config.js`, and parallels the existing `vis.config.ts` at the root.
2. **`extends` paths:** relative (`./` or `../`) or npm-resolvable name. Absolute paths are rejected — they break across machines/CI and there's no legitimate use case in a checked-in config.
3. **`vis.task.ts` scope:** `targets:` only for the MVP. No `tags`/`layer`/`stack`/`language` — those stay in project.json so static query/scope predicates don't need to execute TS. Revisit if dynamic-tag use cases emerge.
4. **Per-package cache:** separate cache entry per project under `node_modules/.cache/vis/`, keyed by `<project-name>:<sha256>`. Editing one package's `vis.task.ts` does not invalidate the root config cache.
5. **`@inherit` in `taskDefaults` blocks:** refers to the _previous-merged-state_ — the cumulative result of all prior layers (extends → root.targetDefaults → preceding taskDefaults blocks). One rule, applies uniformly at every merge site.
