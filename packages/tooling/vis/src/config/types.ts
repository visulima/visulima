import type { ConstraintsConfig, NamedInputs, ProjectConfiguration, TargetConfiguration, TaskRunnerOptions } from "@visulima/task-runner";

import type { SimilarDepFamily } from "../lint/similar-deps";
import type { ToolchainConfig as InternalToolchainConfig, VersionManagerName } from "../runtime/toolchain";
import type { StagedConfig } from "../staged";
import type { VisTargetConfiguration } from "../task/target-options";
import type { VisPlugin } from "../util/hooks";

interface NativeAuditExclusions {
    /** Package names to exclude from audit (yarn berry only). */
    excludedPackages: string[];
    /** Advisory IDs to ignore (CVE-*, GHSA-*, or numeric IDs). */
    ignoredAdvisories: string[];
}

/**
 * The 8 Socket.dev-style supply-chain policies. Used in `security.policies`
 * and `security.acceptedRisks[*].policies`.
 */
export type PolicyName =
    | "first_seen"
    | "install_scripts"
    | "license"
    | "malware"
    | "publisher_change"
    | "score"
    | "unexpected_deps"
    | "vulnerability";

export interface CodeownersConfig {
    /** Workspace-level paths that apply outside any project (e.g., `.github/**`). */
    globalPaths?: Record<string, string[]>;
    /** Sort order for generated entries — mirrors moon's `orderBy`. */
    orderBy?: "file-source" | "project-id";
    /** Provider determines whether `channel` is emitted (GitHub supports it via comment). */
    provider?: "bitbucket" | "github" | "gitlab" | "other";
}

/**
 * One user-declared customTypes entry. See `policy.customTypes.extraTypes`
 * for the full contract — this is just the row shape.
 */
export interface ExtraCustomType {
    /**
     * Required when `strategy === "string"`. The dep-cluster key the bare
     * version string at `path` should be associated with.
     */
    depName?: string;

    /**
     * Display name for this customType. Used as the cluster key prefix in
     * lint output and JSON. Must not collide with the built-in names.
     */
    name: string;
    /** Dot-separated walk into package.json (e.g. `pnpm.overrides`, `myTool.runtime`). */
    path: string;

    /**
     * How to interpret the JSON found at `path`.
     * - `name@version` — single string `pnpm@9.0.0` (with optional `+sha512.…` hash).
     * - `name~version` — single string `node~20.0.0`, mirrors syncpack's tilde form.
     * - `string` — bare version literal (requires `depName`).
     * - `versionsByName` — `{ name: version }` object such as `engines`.
     */
    strategy: "name@version" | "name~version" | "string" | "versionsByName";
}

interface PackageJson {
    bin?: Record<string, string> | string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    workspaces?: string[] | { catalog?: Record<string, string>; packages?: string[] };
}

/**
 * Declared code-owner assignment for a path glob within a project.
 * Mirrors moon's `owners` shape so migrations can round-trip cleanly.
 */
export interface OwnersEntry {
    /** Optional notification channel (e.g. Slack, Teams). */
    channel?: string;
    /** Owner handles (e.g. `@visulima/core-team`). */
    owners: string[];
    /** File/glob pattern relative to the project root. */
    path: string;
}

/**
 * Per-project TypeScript overlay loaded from `vis.task.ts`. Adds a
 * dynamic, type-safe layer for target overrides on top of `project.json`,
 * which stays the canonical home for static metadata (`tags`, `layer`,
 * `stack`, `language`, `owners`, `projectType`, `sourceRoot`,
 * `implicitDependencies`).
 *
 * `vis.task.ts` is opt-in. A package without one behaves identically to
 * before its introduction. Targets defined here merge over `project.json`'s
 * `targets` block — see `design-config-layering.md` for the full
 * precedence stack.
 */
export interface VisTaskConfig {
    /** Per-target overrides — same shape as `project.json#targets`. */
    targets?: Record<string, VisTargetConfiguration>;
}

/**
 * Per-project metadata surfaced by `project.json`. Extended beyond the
 * minimal `projectType` / `tags` / `sourceRoot` fields we historically
 * parsed to include targets, owners, and layer/stack classification.
 */
export interface ProjectJson {
    /** Implicit dependencies on other projects. */
    implicitDependencies?: string[];
    /** Primary language — informational and query-able. */
    language?: string;
    /** Project layer, used for constraint inheritance and query filtering. */
    layer?: "application" | "automation" | "configuration" | "library" | "scaffolding" | "tool";
    /** Code owners for paths inside this project. */
    owners?: OwnersEntry[];
    /** Project-level metadata. */
    project?: {
        channel?: string;
        description?: string;
        maintainers?: string[];
        owner?: string;
        title?: string;
    };

    /**
     * Project type — `library`, `application`, `service`, or `tool`.
     *
     * - `library` — reusable code consumed by other workspace projects.
     * - `application` — end-user-facing build target (web app, mobile app).
     * - `service` — long-running HTTP / worker process deployed independently.
     * - `tool` — CLI or developer tooling shipped as an executable.
     */
    projectType?: "application" | "library" | "service" | "tool";
    /** Source root, used for display and language inference. */
    sourceRoot?: string;
    /** Tech stack. */
    stack?: "backend" | "data" | "frontend" | "infrastructure" | "systems";
    /** Filterable tags. */
    tags?: string[];
    /** Vis-style target definitions (merged on top of package.json scripts). */
    targets?: Record<string, VisTargetConfiguration>;
}

/**
 * A scope predicate used by {@link VisConfig.taskDefaults}.
 * All listed constraints must match for the block to apply.
 */
export interface TaskDefaultsScope {
    /** Match on primary language. */
    language?: string | string[];
    /** Match on project layer. */
    layer?: ProjectJson["layer"] | ProjectJson["layer"][];
    /** Match on project type. */
    projectType?: "application" | "library" | "service" | "tool";
    /** Match on project stack. */
    stack?: ProjectJson["stack"] | ProjectJson["stack"][];
    /** Match projects tagged with any of these tags. */
    tags?: string[];
}

/**
 * A single task-defaults block — a set of target defaults gated by an
 * optional scope predicate.
 */
export interface TaskDefaultsBlock {
    /** Optional scope predicate; if omitted, the block applies universally. */
    scope?: TaskDefaultsScope;
    /** Target default configurations. */
    targets: Record<string, Partial<VisTargetConfiguration>>;
}

export interface VisConfig {
    /** AI analysis configuration */
    ai?: {
        /** Cache TTL in milliseconds. Overrides default (1h / 30min for security). */
        cacheTtl?: number;
        /** Override default provider priority. Higher number = preferred. */
        priority?: Record<string, number>;
        /** Use a specific provider instead of auto-detecting (e.g., `"claude"`, `"gemini"`). */
        provider?: string;
    };

    /**
     * Scope the task-runner cache directory by the current git branch.
     * When `true`, caches are stored under `&lt;cacheDir>/branches/&lt;slug>`
     * so `main` and feature branches stop thrashing each other —
     * generated artefacts (schemas, `.d.ts` snapshots) that legitimately
     * differ across branches no longer oscillate the cache contents.
     *
     * Falls back to the unscoped path on detached HEAD, non-git
     * workspaces, or when git isn't available.
     * @default false
     */
    branchScopedCache?: boolean;

    /**
     * Code ownership configuration. Controls how `vis sync codeowners`
     * renders the generated CODEOWNERS file.
     */
    codeowners?: CodeownersConfig;

    /**
     * Project dependency constraints.
     * Enforced after building the project graph, before running tasks.
     */
    constraints?: ConstraintsConfig;

    /**
     * Configuration for the `vis create` scaffolding command.
     * Controls template downloads (via giget), default options, and
     * post-creation behavior.
     */
    create?: {
        /**
         * Authorization token for downloading private repository templates.
         * Passed as Bearer token to the git host API.
         * Can also be set via GIGET_AUTH, GITHUB_TOKEN, or GH_TOKEN environment variables.
         */
        auth?: string;

        /**
         * Default editor to configure after scaffolding.
         * When set, `vis create` automatically generates editor config files.
         * @example "vscode"
         */
        defaultEditor?: "vscode";

        /**
         * Default package manager for new standalone projects.
         * When set, skips the PM selection prompt in interactive mode.
         */
        defaultPm?: "bun" | "npm" | "pnpm" | "yarn";

        /**
         * Default giget provider for `owner/repo` shorthand inputs.
         * @default "github"
         */
        defaultProvider?: "bitbucket" | "github" | "gitlab" | "sourcehut";

        /**
         * Initialize a git repository after scaffolding standalone projects.
         * @default false
         */
        gitInit?: boolean;

        /**
         * Install dependencies automatically after scaffolding.
         * @default true
         */
        install?: boolean;

        /**
         * Prefer locally cached templates over re-downloading.
         * Useful for offline development or slow connections.
         * @default false
         */
        preferOffline?: boolean;

        /**
         * Custom template registry URL.
         * When set, giget checks this registry for template metadata
         * before falling back to direct provider resolution.
         * Set to `false` to disable registry lookup entirely.
         * @see https://github.com/unjs/giget#custom-registry
         */
        registry?: false | string;

        /**
         * Named template aliases for quick access.
         * Maps short names to full giget source strings.
         * @example
         * ```
         * templates: {
         *   "react": "github:vitejs/vite/packages/create-vite/template-react-ts",
         *   "lib": "github:my-org/lib-template",
         *   "internal": "gitlab:company/templates/node-service",
         * }
         * ```
         */
        templates?: Record<string, string>;
    };

    /**
     * Discover `.editorconfig` for indent / line-ending defaults during
     * file transformations (sort-package-json, migrate, hook, pm overrides,
     * workspace catalog rewrites). Per-command flags can still override.
     * @default true
     */
    editorconfig?: boolean;

    /**
     * Inherit configuration from one or more parent configs. Entries are
     * resolved left-to-right (later wins) and the consumer's own values
     * always override anything pulled in from `extends`.
     *
     * Each entry is either:
     * - a relative path (`./shared.config.ts`, `../shared.config.ts`) —
     *   resolved against the file declaring `extends`;
     * - an npm package name (`@acme/vis-preset`) — resolved via Node.js
     *   module resolution from the consumer file.
     *
     * Absolute paths are rejected — they break across machines and CI.
     * Cycles raise `VisConfigCycleError` during load.
     * @example
     * ```
     * extends: ["@acme/vis-preset", "./shared/security.config.ts"]
     * ```
     */
    extends?: string | string[];

    /**
     * Named file-group patterns, reusable from target `inputs` via the
     * `@filegroup:&lt;name>` token. File groups are resolved relative to each
     * project root at discovery time.
     * @example
     * ```
     * fileGroups: {
     *   sources: ["src/**\/*.ts", "!src/**\/*.test.ts"],
     *   tests: ["**\/*.test.ts"],
     * }
     * ```
     */
    fileGroups?: Record<string, string[]>;

    /**
     * Configuration for the `vis generate` in-repo scaffolding command.
     * Points at additional template directories beyond the defaults
     * (`.vis/templates/` and `.moon/templates/`).
     */
    generator?: {
        /**
         * Authorization token forwarded to giget when fetching
         * `git://`/`npm://` remote templates. Falls back to
         * `GIGET_AUTH` / `GITHUB_TOKEN` / `GH_TOKEN` env vars.
         */
        auth?: string;

        /**
         * Prefer locally cached remote templates over re-downloading.
         * Overridable per invocation via `--prefer-offline`.
         * @default false
         */
        preferOffline?: boolean;

        /**
         * Extra directories to scan for templates. Each directory is
         * checked for both native templates (`&lt;name>.ts`) and
         * moon-format directories (containing `template.yml`).
         * @example
         * ```
         * generator: {
         *   templates: ["./tools/generators", "./packages/scaffolding/templates"],
         * }
         * ```
         */
        templates?: string[];
    };

    /**
     * Auto-create targets from detected config files (Project Crystal-style).
     * Inferred targets sit *below* explicit ones — anything in
     * `package.json#scripts`, `project.json#targets`, or `vis.task.ts`
     * wins per-key, so opting in never overrides existing setups.
     *
     * Built-in detectors and the targets they synthesize:
     *
     * - **App frameworks** — `nuxt` (build/dev/preview/generate),
     *   `next` (build/dev/start), `remix` (build/dev/start), `astro`
     *   (build/dev), `gatsby` (build/develop/serve), `docusaurus`
     *   (build/start/serve).
     * - **Bundlers** — `vite` (build/dev/preview), `rolldown` (build),
     *   `tsdown` (build), `tsup` (build), `packem` (build), `rollup`
     *   (build), `webpack` (build).
     * - **Docs sites** — `vitepress` (docs:build/docs:dev/docs:preview),
     *   `typedoc` (docs).
     * - **Server frameworks** — `nest` (build/start/start:dev).
     * - **Test runners** — `vitest` (test/test:watch), `jest`
     *   (test/test:watch), `bun` (test), `playwright` (test:e2e),
     *   `cypress` (test:e2e/cypress:open).
     * - **Stories** — `storybook` (storybook/build-storybook).
     * - **Type checking** — `typescript` (typecheck via `tsc --noEmit`).
     * - **Lint / format** — `eslint` (lint), `prettier` (format /
     *   format:check), `biome` (lint, format), `oxlint` (lint),
     *   `oxfmt` (format / format:check), `stylelint` (lint:css),
     *   `knip` (knip).
     * - **Runtimes** — `deno` (test/lint/fmt/check).
     * - **Database tooling** — `prisma` (db:generate/db:migrate/
     *   db:push/db:studio), `drizzle` (db:generate/db:migrate/
     *   db:push/db:studio).
     * - **Codegen / release** — `graphql-codegen` (codegen),
     *   `api-extractor` (api-extract), `changeset` (changeset:version /
     *   changeset:publish / changeset:status).
     *
     * Trigger: presence of any matching config file in the project root.
     * Most detectors additionally match when their framework appears in
     * `dependencies` / `devDependencies` / `peerDependencies` /
     * `optionalDependencies` — covering convention-only setups (e.g.
     * vitest with default config). Detectors that intentionally require
     * a config file (because the package frequently appears transitively
     * and a dep-only match would synthesize broken commands): `vite`,
     * `rolldown`, `rollup`, `webpack`, `storybook`, `nest`, `remix`,
     * `vitepress`, `bun`, `deno`, `changeset`.
     *
     * Conflict resolution: detectors are evaluated in registration order
     * (see `BUILT_IN_DETECTORS`) and the first to claim a target name
     * wins. Per-name priorities: `build` → nuxt > next > remix > astro
     * > gatsby > docusaurus > vite > nest > rolldown > tsdown > tsup >
     * packem > rollup > webpack; `test` → vitest > jest > bun > deno;
     * `test:e2e` → playwright > cypress; `lint` → eslint > biome >
     * oxlint > deno; `format` → prettier > biome > oxfmt; `db:*` →
     * prisma > drizzle.
     *
     * Also accepts an object form (`{ vite: false, vitest: true }`) to
     * opt individual detectors in or out by name. Detectors omitted from
     * the object run at their default (enabled). Useful when one
     * detector misfires for a given workspace without disabling the rest.
     * @default false
     */
    inferTargets?: Record<string, boolean> | boolean;

    /**
     * Installer backend selection for `vis install` / `vis add` /
     * `vis remove` / `vis update` / `vis ci`.
     *
     * Lets users opt into [aube](https://github.com/endevco/aube) — a
     * Rust-native package manager that reads/writes pnpm/npm/yarn/bun
     * lockfiles in place — as the default installer, while keeping a
     * single switch to fall back to the conventional PM detected from
     * the lockfile.
     *
     * Resolution precedence (highest first):
     * 1. CLI flag (`--installer &lt;name>` / `--no-aube`)
     * 2. Env var `VIS_INSTALLER`
     * 3. This config field
     * 4. Auto-detect (the default)
     *
     * Aube must be installed separately — `vis` does not bundle it.
     * Install via npm (`@endevco/aube`), `mise use -g aube`, or
     * `brew install endevco/tap/aube`.
     */
    install?: {
        /**
         * Which package manager performs install/add/remove/etc.
         * - `auto` (default): use `aube` when it is on PATH; otherwise
         *   fall back to the lockfile-detected PM.
         * - explicit name: always use that PM. Errors when the named
         *   binary is missing rather than silently falling back.
         * @default "auto"
         */
        backend?: "aube" | "auto" | "bun" | "npm" | "pnpm" | "yarn";

        /**
         * Whether to dispatch PM invocations through `corepack`.
         * - `"auto"` (default): use corepack only when the workspace
         *   pins a PM via the `packageManager` field AND `corepack` is
         *   on PATH AND the PM is one corepack manages (pnpm/yarn/npm).
         * - `true`: always prefix `corepack` when the binary is on PATH
         *   and the PM is corepack-managed (errors loudly otherwise).
         * - `false`: never go through corepack — invoke the PM directly.
         *
         * Mirrors nypm's `corepack: true` flag. Bun, deno, and aube are
         * never wrapped — corepack does not manage them.
         * @default "auto"
         */
        corepack?: "auto" | boolean;
    };

    /**
     * `vis-mcp` promotion notice shown after successful commands when an
     * AI CLI (Claude Code, Cursor, Windsurf, Continue, Zed, Cline) is
     * installed but `@visulima/vis-mcp` is not wired into its config.
     *
     * Shown at most once every 14 days; skipped in CI, non-TTY shells,
     * during `--help`/`--version`/`ai`/`mcp` invocations, and when
     * `VIS_NO_MCP_PROMOTE=1` is set. Set `enabled: false` to silence
     * permanently for this workspace.
     * @example
     * ```
     * mcpPromote: { enabled: false }
     * ```
     */
    mcpPromote?: {
        /**
         * Show the vis-mcp promotion notice on successful command completion.
         * @default true
         */
        enabled?: boolean;
    };

    /**
     * Named input patterns inherited by every project target. Equivalent
     * to task-runner's `namedInputs` but configurable from the vis config.
     */
    namedInputs?: NamedInputs;

    /** Package override mappings applied during migration (e.g., `{ "lodash": "lodash-es" }`) */
    overrides?: Record<string, string>;

    /**
     * Plugins — each plugin registers typed hooks that fire at run /
     * task / cache boundaries. See {@link VisPlugin} for the contract.
     * Prefer plugins over per-target shell hooks when behaviour needs
     * access to task metadata, results, or cache state.
     */
    plugins?: VisPlugin[];

    /**
     * Workspace dep-policy lints exposed via `vis lint`. Each block opts in
     * to a single rule; the command flags (`--workspace-protocol`,
     * `--no-redefine-root`, `--banned-deps`) toggle them per-run.
     */
    policy?: {
        /**
         * Map of dep names or globs → reason (or `{ reason, replacement, packages?, paths? }`).
         * Internal/workspace deps are never flagged here; the
         * workspace-protocol lint owns those.
         *
         * Optional `packages` (globs over the declaring package's `name`) and
         * `paths` (globs over the workspace-relative `packageDir`) narrow where
         * the rule applies. With both set, either match is enough. Omit both
         * to ban anywhere — the default.
         * @example
         * ```
         * bannedDeps: {
         *   request: "deprecated; use undici",
         *   moment: { reason: "huge bundle, frozen upstream", replacement: "date-fns" },
         *   "@radix-ui/*": "we standardized on shadcn",
         *   react: { reason: "no react in shared libs", paths: ["packages/shared/*"] },
         *   "next": { reason: "apps only", packages: ["@app/*"] },
         * }
         * ```
         */
        bannedDeps?: Record<string, string | { packages?: string[]; paths?: string[]; reason: string; replacement?: string }>;

        /**
         * Tweak the custom-types lint that flags drift in `engines.{node,pnpm,...}`,
         * `packageManager`, `volta.{node,pnpm,yarn}`, and the proposed
         * `devEngines.{runtime,packageManager}` array form.
         *
         * Each (customType × name) cluster is tracked independently —
         * `engines.node` and `volta.node` don't cross-couple here. Use a
         * versionGroup once that lands if you need to enforce they agree.
         */
        customTypes?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — same semantics, applied to drift rewrites
             * across engines / packageManager / volta / devEngines.
             *
             * Note: `--fix` strips any `+sha512.&lt;hash&gt;` suffix from
             * `packageManager` on bump — content-integrity hashes are tied
             * to a specific package, not a version, so users must regenerate
             * via their PM (`pnpm install` re-pins; `corepack use pnpm@X` etc.).
             * @default true
             */
            autofix?: "prompt" | boolean;

            /**
             * User-defined custom-type pin locations. Each entry tells the
             * customTypes lint to read additional version pins from a
             * non-standard JSON path inside every workspace package.json,
             * cluster them by `(name × depName)` like the built-in types,
             * and rewrite them with `--fix`.
             *
             * The original built-ins (`engines`, `volta`, `packageManager`,
             * `devEngines.runtime`, `devEngines.packageManager`) keep
             * running unconditionally — these layer on top.
             *
             * Strategies:
             * - `versionsByName`: the JSON at `path` is `{ [depName]: version }`
             *   (like `engines` or `pnpm.overrides`).
             * - `name@version`: the JSON at `path` is a string of the form
             *   `name@version` (like `packageManager`). The leading `name@`
             *   is preserved; only the version segment is rewritten.
             * - `string`: the JSON at `path` is a bare version string. The
             *   `depName` field is required and identifies the dep cluster.
             *
             * `name` must not collide with a built-in type name. `path` is
             * a dot-separated walk into the package.json (e.g. `pnpm.overrides`).
             * @example
             * ```ts
             * extraTypes: [
             *   { name: "pnpmOverridesLegacy", path: "pnpm.overrides", strategy: "versionsByName" },
             *   { name: "myToolPin",           path: "myTool.runtime", strategy: "name@version" },
             *   { name: "minNode",             path: "config.minNode", strategy: "string", depName: "node" },
             * ]
             * ```
             */
            extraTypes?: ExtraCustomType[];

            /**
             * Dep names exempt from the drift check (exact match against the
             * field name within the block — e.g. `node`, `pnpm`).
             */
            ignore?: string[];

            /**
             * Resolution strategy used when `--fix` runs.
             * - `highest` (default): align every drifting instance to the
             *   highest declared version.
             * - `lowest`: align to the lowest.
             * @default "highest"
             */
            resolve?: "highest" | "lowest";
        };

        /**
         * Tweak the dead-workspace-patterns lint that flags entries in
         * `pnpm-workspace.yaml#packages` / `package.json#workspaces` which
         * resolve to zero on-disk directories.
         */
        deadWorkspacePatterns?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — applied here to dropping unmatched patterns
             * from the workspace config file.
             * @default true
             */
            autofix?: "prompt" | boolean;
        };

        /**
         * Tweak the empty-deps lint that flags empty `dependencies` /
         * `devDependencies` / `peerDependencies` / `optionalDependencies`
         * blocks across the workspace.
         */
        emptyDeps?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — applied here to removing the empty key.
             * @default true
             */
            autofix?: "prompt" | boolean;

            /**
             * Block names exempt from the rule (e.g. `["peerDependencies"]`
             * to keep the key around as a marker even when empty).
             */
            ignoreBlocks?: ("dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies")[];
        };

        /**
         * Tweak the redefine-root lint that flags non-root packages duplicating
         * deps already pinned at the workspace root.
         */
        redefineRoot?: {
            /** Dep names that are exempt from the redefine-root rule (exact match). */
            ignore?: string[];
        };

        /**
         * Tweak the root-deps lint that flags runtime `dependencies` declared
         * on the private workspace root (they should live in `devDependencies`).
         */
        rootDeps?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — applied here to moving entries from
             * `dependencies` to `devDependencies` on the root package.json.
             * @default true
             */
            autofix?: "prompt" | boolean;
        };

        /**
         * Tweak the root-package-manager lint that flags a missing or
         * malformed `packageManager` field on the workspace root.
         */
        rootPackageManager?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract. `--fix` only writes when `suggested` is set —
             * a missing `packageManager` field has no canonical default.
             * @default true
             */
            autofix?: "prompt" | boolean;

            /**
             * Canonical specifier (`name@version`) to write when `--fix` runs
             * and the field is absent. Required to enable autofix —
             * vis won't guess the workspace's preferred manager.
             * @example "pnpm@10.32.1"
             */
            suggested?: string;
        };

        /**
         * Tweak the root-private lint that flags a workspace root package.json
         * missing `"private": true`. Only fires when the root looks like a
         * workspace (npm/yarn/bun `workspaces` field or `pnpm-workspace.yaml`).
         */
        rootPrivate?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — applied here to inserting `"private": true`.
             * @default true
             */
            autofix?: "prompt" | boolean;
        };

        /**
         * Tweak the similar-deps lint that flags drift across related dep
         * families (e.g. `react` and `react-dom`, all of `@babel/*`).
         *
         * The lint is report-only — aligning a family requires picking a
         * single canonical specifier across heterogeneous range syntaxes
         * (`^`, `~`, exact), which is too lossy without user input.
         */
        similarDeps?: {
            /**
             * Additional families merged with the built-ins. Same `id` wins
             * → user override fully replaces the built-in entry.
             * @example
             * ```
             * extraFamilies: [
             *   { id: "vue", label: "Vue", members: ["vue", "vue-router", "pinia"] },
             * ]
             * ```
             */
            extraFamilies?: SimilarDepFamily[];
            /** Family ids to skip entirely (matches `SimilarDepFamily.id`). */
            ignoreFamilies?: string[];
        };

        /**
         * Tweak the types-in-deps lint that flags `@types/*` declared in
         * `dependencies` on a private package (they belong in
         * `devDependencies` since the package never ships).
         */
        typesInDeps?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — applied here to moving the entry to
             * `devDependencies`. Existing dev pins are preserved on conflict.
             * @default true
             */
            autofix?: "prompt" | boolean;
            /** Dep names exempt from the rule (exact match, e.g. `@types/node`). */
            ignore?: string[];
        };

        /**
         * Tweak the workspace-protocol lint that flags internal deps not
         * using the `workspace:` protocol.
         */
        workspaceProtocol?: {
            /**
             * Three-state autofix opt-out. Some workspaces want detection
             * without rewrite (e.g. dual-licensed packages where `workspace:*`
             * is unsafe).
             * - `true` (default): `--fix` rewrites the specifier.
             * - `false`: never rewrite — report the violation only.
             * - `"prompt"`: ask before each rewrite. Falls back to report-only
             *   when stdin isn't a TTY (CI). Reserved; not yet implemented.
             *
             * Note: when `false` (or `"prompt"`), `--fix` still **fails CI** on
             * detected violations — the rule is "report only", not "ignore".
             * Drop the rule from the lint selection if you want a clean exit.
             * @default true
             * @example
             * ```
             * policy: {
             *   workspaceProtocol: { autofix: false },
             * }
             * ```
             */
            autofix?: "prompt" | boolean;
        };

        /**
         * Tweak the workspace-versions lint that flags external deps declared
         * at inconsistent versions across the workspace.
         */
        workspaceVersions?: {
            /**
             * Three-state autofix opt-out. See `workspaceProtocol.autofix`
             * for the contract — same semantics, applied to drift rewrites.
             *
             * Also gates the `--propose-min` catalog suggestion writer:
             * when `false` / `"prompt"`, `--fix --propose-min` reports the
             * proposed catalog entries but does not write
             * `pnpm-workspace.yaml`. Same "report only, still fails CI"
             * note applies as on `workspaceProtocol.autofix`.
             * @default true
             */
            autofix?: "prompt" | boolean;

            /** Dep names exempt from the version-drift check (exact match). */
            ignore?: string[];

            /**
             * Resolution strategy used when `--fix` runs.
             * - `highest` (default): rewrite every drifting instance to the
             *   highest sibling specifier.
             * - `lowest`: rewrite to the lowest.
             * - `catalog`: rewrite any dep already pinned in a workspace catalog
             *   to `catalog:` / `catalog:&lt;name>`. Catalog must exist; this lint
             *   does not create the catalog (see `vis lint --resolve catalog --propose`).
             * @default "highest"
             */
            resolve?: "catalog" | "highest" | "lowest";
        };
    };

    /**
     * Pre-flight checks fired before `vis run` starts the orchestrator.
     * Each check is opt-out (`false`) — defaults are sensible for the
     * common monorepo case.
     */
    preflight?: {
        /**
         * Detect "lockfile changed but `node_modules` is stale" before
         * running tasks. Compares lockfile mtime against the
         * package-manager-specific install marker
         * (`node_modules/.modules.yaml` for pnpm, `.package-lock.json`
         * for npm, etc.). Warns in TTY, hard-fails in CI.
         * @default true
         */
        lockfile?: boolean;
    };

    /**
     * Behavior of `vis run` when invoked tasks declare service dependencies
     * that aren't running in the workspace registry. CLI `--services=&lt;mode>`
     * overrides this block.
     */
    run?: {
        /**
         * Wrap each task's CI log block in collapsible groups so users
         * can fold/unfold per-task output in the host CI's web UI.
         * Failed tasks always render expanded so the failure is visible
         * without an extra click.
         *
         * - `auto` (default): pick the format from the detected runner —
         *   `GITHUB_ACTIONS=true` → `github` (`::group::`),
         *   `GITLAB_CI=true` → `gitlab` (`section_start:` ANSI sequences),
         *   `BUILDKITE=true` → `buildkite` (`---` collapsed headers),
         *   `TF_BUILD=True` → `azure` (`##[group]`),
         *   no grouping otherwise.
         * - `off`: never group (raw separators only — useful when
         *   piping through tools that mangle the directives).
         * - `azure` / `buildkite` / `github` / `gitlab`: force the format
         *   regardless of detected environment (useful for self-hosted
         *   runners that don't set the standard env vars).
         *
         * CircleCI is intentionally not auto-detected: its 2.0+ format
         * has no inline grouping directive — steps auto-group in the
         * web UI without any markup from the runner.
         */
        ciGrouping?: "auto" | "azure" | "buildkite" | "github" | "gitlab" | "off";

        /**
         * One knob controlling auto-start of missing service deps.
         * - `auto` (default in TTY): pick by task — `dev` → ephemeral,
         *   others → persistent.
         * - `ephemeral`: services die with the run (no registry entry).
         * - `persistent`: services persist across runs in the registry.
         * - `off` (default in CI / non-TTY): print diagnostics and abort.
         */
        services?: "auto" | "ephemeral" | "off" | "persistent";
    };

    /**
     * Default options for `vis secrets`. CLI flags always take precedence;
     * this block provides workspace-wide defaults so teams can commit config
     * once and every invocation picks it up.
     */
    secrets?: {
        /** Path to a baseline of previously-triaged findings (relative to workspace root). */
        baseline?: string;

        /** Where the ruleset comes from. Omit for the bundled gitleaks default. */
        config?: {
            /** Layer the user's rules on top of the bundled ruleset. Default: `true`. */
            extendBundled?: boolean;
            /** Inline rule overrides. Wins over `path` when both are set. */
            inline?: {
                allowlist?: unknown;
                allowlists?: unknown[];
                description?: string;
                rules?: unknown[];
                title?: string;
            };
            /** Path to a JSON config (gitleaks-compatible). */
            path?: string;
            /** Bundled presets layered on top of the default ruleset (e.g. `"weak-passwords"`). */
            presets?: string[];
        };

        /** Redact secret values in findings. */
        redact?: boolean;

        /** Rule-id filters applied after scanning. */
        rules?: {
            /** Drop findings whose ruleId matches. */
            exclude?: string[];
            /** Only report findings whose ruleId matches. */
            include?: string[];
        };

        /** Walker / filesystem traversal. */
        walk?: {
            /**
             * Paths to additional `.gitignore`-syntax files (e.g. `.secretsignore`).
             */
            excludeFromFiles?: string[];

            /**
             * Gitignore-syntax patterns (supports negation, directory markers, leading `/`).
             * Applied on top of `.gitignore`.
             */
            excludePatterns?: string[];
            /** Respect `.gitignore`. Default: `true`. */
            gitignore?: boolean;
            /** Include hidden (dotfile) entries. Default: `false`. */
            includeHidden?: boolean;
            /** Max file size in bytes. Default 10 MiB. */
            maxFileSize?: number;
        };
    };

    /**
     * Supply chain security settings.
     * These settings are inspired by pnpm's security features and are applied
     * universally across all package managers (pnpm, npm, yarn, bun).
     *
     * For pnpm users: these map directly to pnpm-workspace.yaml settings.
     * For npm/yarn/bun users: vis enforces these at the vis layer since
     * those package managers lack native support.
     */
    security?: {
        /**
         * Packages whose policy findings have been reviewed and explicitly
         * accepted. Matched against every policy unless `policies` narrows the
         * scope. Replaces the legacy `security.socket.acceptedRisks` map.
         *
         * Key format: package name (`"lodash"`), name@version
         * (`"lodash@4.17.21"`), or glob (`"@myorg/*"`). Unversioned keys match
         * all versions of that package.
         * @example
         * ```
         * acceptedRisks: {
         *   "some-risky-pkg": {
         *     reason: "Internal fork, low score expected",
         *     acceptedAt: "2026-03-15T10:00:00Z",
         *     acceptedScore: 0.25,
         *     policies: ["score"],
         *     expiresAt: "2026-12-31",
         *   },
         * }
         * ```
         */
        acceptedRisks?: Record<
            string,
            {
                /** ISO 8601 timestamp when the risk was accepted. */
                acceptedAt: string;
                /**
                 * The overall Socket.dev score at the time of acceptance.
                 * Only relevant for the `score` policy; ignored elsewhere.
                 */
                acceptedScore?: number;
                /**
                 * ISO 8601 date (or datetime). After this point the acceptance
                 * stops applying and vis emits a warning. Leave undefined for
                 * non-expiring entries.
                 */
                expiresAt?: string;
                /**
                 * Which policies this acceptance covers. When undefined the
                 * acceptance applies to every policy finding on this package.
                 */
                policies?: PolicyName[];
                /** User-provided reason for accepting the risk. */
                reason: string;
            }
        >;

        /**
         * Offline OSV advisory + `vis audit` configuration.
         *
         * Controls `vis audit --offline` and `vis advisories sync` behavior:
         * - `audit.advisories.source` is the OSV mirror to download from. It
         *   must be `https://` and resolve to a host in `allowedHosts` (or one
         *   of the built-in defaults).
         * - `audit.offlineByDefault` flips the default of `--offline`.
         *
         * Vulnerability severity gating and reachability filtering live under
         * `policies.vulnerability` (see below).
         */
        audit?: {
            /**
             * Offline advisory cache settings.
             */
            advisories?: {
                /**
                 * Extra hosts permitted as `audit.advisories.source`. The
                 * built-in allowlist is enforced even if this field is
                 * omitted; entries here add to it.
                 * @example ["mirror.corp.example.com"]
                 */
                allowedHosts?: string[];

                /**
                 * Number of hours after `lastSyncIso` before `vis audit`
                 * prints a "your advisory cache may be stale" notice.
                 * `vis audit` never auto-syncs — the user runs
                 * `vis advisories sync` themselves.
                 * @default 24
                 */
                refreshIntervalHours?: number;

                /**
                 * OSV mirror base URL (no trailing slash). Defaults to the
                 * public Google Cloud Storage bucket
                 * (`https://osv-vulnerabilities.storage.googleapis.com`).
                 * Override to point at a corporate mirror.
                 */
                source?: string;

                /**
                 * Sigstore signature verification for the OSV dump.
                 * Requires the native binding to be built with the
                 * `verify-signatures` Cargo feature (default in the release
                 * build). Off by default — the upstream OSV bucket does not
                 * ship signatures today.
                 */
                verify?: {
                    /**
                     * Enable signature verification. The sync flow downloads
                     * `&lt;eco>/all.zip.sig` next to the zip and aborts if it
                     * cannot verify against `expectedIssuer` / `expectedSubject`.
                     * @default false
                     */
                    enabled?: boolean;
                    /** OIDC issuer that signed the bundle. */
                    expectedIssuer?: string;
                    /** OIDC subject (workload identity) that signed the bundle. */
                    expectedSubject?: string;
                };
            };

            /**
             * Gates for the auto-fix flow (`vis audit --fix` /
             * `--fix-transitive`). The CLI prompts outside CI; inside CI
             * the flags refuse to run unless `--yes` is set and, for
             * transitives, `apply.transitive.enabled = true`.
             */
            apply?: {
                /**
                 * Gates for `vis audit --fix-transitive`. Two-lock: the
                 * CLI requires `--yes` AND this flag set to `true` before
                 * it will rewrite override entries in CI.
                 */
                transitive?: {
                    /**
                     * When true, allows `--fix-transitive` to run in CI
                     * environments. Defaults to false because rewriting
                     * overrides is a higher blast radius than bumping a
                     * direct dep.
                     * @default false
                     */
                    enabled?: boolean;
                };
            };

            /**
             * When true, `vis audit` skips network calls and queries the
             * offline cache. Equivalent to the CLI `--offline` flag.
             * @default false
             */
            offlineByDefault?: boolean;
        };

        /**
         * Map of bin names (or `pkg#bin` qualifiers) blessed for shadowing.
         * When two installed packages expose the same bin name, vis flags
         * the collision in `vis security list` and the post-install drift
         * report — set the bin (or `pkg#bin`) to `true` here to suppress
         * the warning once you've reviewed the conflict.
         *
         * Port of LavaMoat allow-scripts' experimental `allowBins`.
         * Bare names match any conflicting bin with that name; the
         * `pkg#bin` form scopes the approval to a single package's bin.
         * @example
         * ```
         * allowBins: {
         *   tsc: true,                // bless any 'tsc' bin
         *   "typescript#tsc": true,   // bless only typescript's 'tsc'
         * }
         * ```
         */
        allowBins?: Record<string, boolean>;

        /**
         * When true, prevents transitive dependencies from using exotic sources
         * (git repositories, direct tarball URLs). Only direct dependencies may
         * use such sources. Equivalent to pnpm's `blockExoticSubdeps`.
         * @default false
         */
        blockExoticSubdeps?: boolean;

        /**
         * When true, `security.policies.install_scripts.allow` keys are matched
         * as `name@version`. A version bump on an approved package drops it from
         * the allowlist until the new version is explicitly re-approved (port
         * of LavaMoat allow-scripts' version-aware policy matcher).
         *
         * After a version bump, run `vis approve-builds` or `vis security list`
         * — both surface a "Version drift" block with the suggested new key
         * (`old-key  →  new-key`) so you can update `vis.config.ts` by hand.
         * @default false
         */
        pinVersions?: boolean;

        /**
         * Supply-chain policy gates. Each sub-block enables one policy and
         * configures its behavior. When a sub-block is omitted the policy is
         * inactive. `acceptedRisks` (above) silences specific packages without
         * disabling a policy globally.
         *
         * The 8 policies are inspired by Socket.dev's classification:
         * - `malware`            — Socket-flagged malicious packages
         * - `first_seen`         — packages published less than N minutes ago
         * - `unexpected_deps`    — packages outside an allow-list / baseline
         * - `publisher_change`   — maintainer set changed between installs
         * - `install_scripts`    — preinstall/install/postinstall scripts
         * - `score`              — Socket overall score below threshold
         * - `vulnerability`      — OSV vulnerability findings
         * - `license`            — SPDX allow / deny lists
         */
        policies?: {
            /**
             * Minimum number of minutes that must pass after a version is
             * published before vis will allow installation. Migrated from
             * the legacy `security.minimumReleaseAge` field. Equivalent to
             * pnpm's `minimumReleaseAge`.
             * @default 0
             * @example { minutes: 1440, exclude: ["@myorg/*"] } // 24 hours
             */
            first_seen?: {
                /**
                 * Package names/patterns excluded from the first_seen check.
                 * Equivalent to pnpm's `minimumReleaseAgeExclude`.
                 * @example ["webpack", "react", "@myorg/*"]
                 */
                exclude?: string[];
                /** Minutes after publish before install is allowed. */
                minutes?: number;
            };

            /**
             * Build-script (pre/install/postinstall/prepare) controls.
             * Migrated from the legacy `security.allowBuilds` /
             * `security.strictDepBuilds` fields.
             * @example { allow: { esbuild: true }, strict: true }
             */
            install_scripts?: {
                /**
                 * Map of package names/patterns to allow (true) or deny
                 * (false) build scripts. Packages not listed are denied
                 * by default. Equivalent to pnpm's `allowBuilds`.
                 */
                allow?: Record<string, boolean>;
                /**
                 * When true, installation will fail (exit non-zero) if any
                 * dependencies have unreviewed build scripts. Equivalent to
                 * pnpm's `strictDepBuilds`.
                 * @default false
                 */
                strict?: boolean;
            };

            /**
             * SPDX license allow / deny lists. Deny wins on any sub-license
             * match in SPDX expressions (`(MIT OR GPL-3.0)` against
             * `deny: ["GPL-3.0"]` is blocked). Packages with no declared
             * license are flagged when `allow` is set.
             * @example
             * ```
             * license: {
             *   allow: ["MIT", "Apache-2.0", "BSD-3-Clause"],
             *   deny: ["GPL-3.0", "AGPL-3.0"],
             * }
             * ```
             */
            license?: {
                /**
                 * SPDX identifiers that are explicitly permitted. When set,
                 * any package whose declared license is not on this list is
                 * blocked.
                 */
                allow?: string[];
                /**
                 * SPDX identifiers that are explicitly forbidden. Always
                 * wins over `allow` when both reference the same identifier.
                 */
                deny?: string[];
            };

            /**
             * Behavior when the Socket.dev feed flags a package as malicious
             * (`alerts[].type === "Malware"`).
             * @default { mode: "block" } when Socket is enabled, off otherwise
             */
            malware?: {
                /**
                 * - `"block"` — emit a block decision.
                 * - `"warn"`  — surface as a warning; do not gate exit code.
                 * - `"off"`   — disable the policy entirely.
                 */
                mode?: "block" | "off" | "warn";
            };

            /**
             * Trust-level checking for package publishing. Migrated from the
             * legacy `security.trustPolicy*` fields. Equivalent to pnpm's
             * `trustPolicy`.
             * @example { mode: "no-downgrade", ignoreAfter: 43200 } // 30 days
             */
            publisher_change?: {
                /**
                 * Package selectors excluded from the check.
                 * Equivalent to pnpm's `trustPolicyExclude`.
                 * @example ["chokidar@4.0.3"]
                 */
                exclude?: string[];
                /**
                 * Ignore packages published more than N minutes ago. Useful
                 * for older packages that pre-date provenance support.
                 * Equivalent to pnpm's `trustPolicyIgnoreAfter`.
                 */
                ignoreAfter?: number;
                /**
                 * - `"off"`           — no trust checking (default).
                 * - `"no-downgrade"`  — block when a package's trust level
                 *   has decreased compared to previous releases (e.g., was
                 *   published by trusted publisher, now only has provenance).
                 */
                mode?: "no-downgrade" | "off";
            };

            /**
             * Socket.dev overall-score threshold. Packages scoring below
             * `minimum` trigger a block decision (or interactive prompt
             * during `vis add`). Migrated from the legacy
             * `security.socket.minimumScore` field.
             * @example { minimum: 0.4 }
             */
            score?: {
                /**
                 * Minimum overall Socket.dev score (0–1). Set to 0 to
                 * disable the gate while keeping Socket data fetched.
                 * @default 0.4
                 */
                minimum?: number;
            };

            /**
             * Net-new transitive dependency detection. Either provide a
             * static allow-list, a baseline lockfile path (recommended), or
             * both — the intersection is enforced.
             * @example { baselineLockfile: "./security/lockfile.baseline.yaml" }
             */
            unexpected_deps?: {
                /**
                 * Allow-list of dependency names that may appear in the
                 * resolved package set. Glob patterns are supported.
                 * @example ["lodash", "axios", "@myorg/*"]
                 */
                allow?: string[];
                /**
                 * Path (absolute or relative to the workspace root) to a
                 * baseline lockfile snapshot. The policy diffs the current
                 * lockfile against this baseline and flags any package that
                 * didn't exist before.
                 * @example "./security/lockfile.baseline.yaml"
                 */
                baselineLockfile?: string;
            };

            /**
             * OSV vulnerability gating. Migrated from the legacy
             * `security.audit.failOn` + `security.audit.usage` fields.
             */
            vulnerability?: {
                /**
                 * Severity threshold that makes `vis audit` exit non-zero.
                 * Equivalent to the CLI `--fail-on` flag.
                 * @example "high"
                 */
                failOn?: "critical" | "high" | "low" | "medium";
                /**
                 * Reachability filter — only report vulnerabilities in
                 * packages the workspace statically imports.
                 */
                usage?: {
                    /**
                     * Packages to always treat as reachable even if no
                     * static import is found.
                     * @example ["esbuild", "webpack-cli"]
                     */
                    alwaysAssumeUsed?: string[];
                    /**
                     * Enable the reachability filter by default. Equivalent
                     * to `--usage` on the CLI; `--no-usage` disables.
                     * @default false
                     */
                    enabled?: boolean;
                };
            };
        };

        /**
         * Socket.dev data-source configuration. Connection knobs only — score
         * thresholds and accepted-risk overrides moved to `policies.score` and
         * `security.acceptedRisks` respectively.
         * @see https://socket.dev
         */
        socket?: {
            /**
             * Custom Socket.dev API token. Falls back to the public API token.
             * Set via VIS_SOCKET_TOKEN environment variable or here.
             */
            apiToken?: string;

            /**
             * Cache TTL in milliseconds for Socket.dev reports.
             * @default 3_600_000 (1 hour)
             */
            cacheTtlMs?: number;

            /**
             * Enable Socket.dev security scanning on install/update/check commands.
             * @default false
             */
            enabled?: boolean;

            /**
             * Request timeout in milliseconds for the Socket.dev API.
             * @default 15_000 (15 seconds)
             */
            timeoutMs?: number;
        };

        /**
         * Package names to skip during typosquat detection.
         * Use this for internal packages or known-safe names that happen to
         * look similar to popular packages.
         * @example ["my-internal-axois", "@myorg/recat"]
         */
        typosquatAllowlist?: string[];
    };

    /**
     * Share the cache between sibling git worktrees. When the workspace is a
     * linked worktree (created with `git worktree add`), the cache root is
     * relocated from `&lt;linkedRoot>/.vis/cache` to the *main*
     * worktree's `.vis/cache`. Multiple parallel agents working in
     * sibling worktrees then share a single cache instead of rebuilding the
     * same hash N times.
     *
     * Single-checkout repos (where `.git` is a directory) are unaffected.
     *
     * Set to `false` to opt out — useful when worktrees deliberately need
     * independent caches, e.g. for hermetic experiments.
     * @default true
     */
    sharedWorktreeCache?: boolean;

    /** sort-package-json command defaults */
    sortPackageJson?: {
        /** Discover `.editorconfig` for indent / line-ending defaults (default: true). */
        editorconfig?: boolean;
        /** Collapse `bugs: { url }` to the bare string form when `url` is the only field (default: true). */
        formatBugs?: boolean;
        /** Collapse `repository: { type, url }` to the GitHub `owner/repo` shorthand (default: true). */
        formatRepository?: boolean;
        /** Sort `exports` condition keys in canonical order (default: true). */
        sortExports?: boolean;
        /** Alphabetize script commands (default: false) */
        sortScripts?: boolean;
    };

    /**
     * Sponsorship notice shown after successful commands.
     *
     * vis prints a one-line "consider sponsoring visulima" notice at most
     * once every 14 days (skipped in CI, non-TTY, and when
     * `VIS_NO_SPONSOR=1` is set). Set `enabled: false` to silence it
     * permanently for this workspace.
     * @example
     * ```
     * sponsor: { enabled: false }
     * ```
     */
    sponsor?: {
        /**
         * Show the sponsor notice on successful command completion.
         * @default true
         */
        enabled?: boolean;
    };

    /**
     * Staged file patterns and commands (replaces lint-staged).
     *
     * Accepts all lint-staged config forms:
     * - `string` or `string[]` commands
     * - Sync/async functions returning `string | string[]`
     * - `{ title, task }` objects for named side-effect tasks
     * - Mixed arrays of strings and functions
     * - A top-level generate-task function
     */
    staged?: StagedConfig;

    /**
     * When `true`, every task command is scanned for `${VAR}` / `$VAR`
     * references before spawn. If a referenced var is unset in the
     * task's effective env (envFile + service env + per-task `env` +
     * `process.env`), the task fails with an actionable error
     * naming the missing variable, instead of letting the shell
     * silently substitute an empty string.
     *
     * Override per run with `--strict-env` / `--no-strict-env`.
     * Override per target with `options.strictEnv`.
     * @default false
     */
    strictEnv?: boolean;

    /** Target default configurations */
    targetDefaults?: Record<string, Partial<VisTargetConfiguration>>;

    /**
     * Cascading task-default blocks. Each block may scope its targets to a
     * subset of projects via `scope`. Blocks are evaluated in order; later
     * blocks override earlier ones when the same field is set.
     *
     * Scope matching is additive — if `scope` is omitted, the block applies
     * to every project.
     * @example
     * ```
     * taskDefaults: [
     *   { scope: { tags: ["frontend"] }, targets: { build: { cache: true } } },
     *   { scope: { projectType: "library" }, targets: { lint: { cache: true } } },
     * ]
     * ```
     */
    taskDefaults?: TaskDefaultsBlock[];

    /**
     * Named bundles of target dependencies, referenceable from any task's
     * `dependsOn`. `dependsOn: [{ group: "lint" }]` expands to every entry
     * in the named group; nested groups are resolved recursively and a
     * cycle raises during discovery.
     */
    taskGroups?: Record<string, (string | { dependencies?: boolean; projects?: string | string[]; target: string } | { group: string })[]>;

    /**
     * Task runner options forwarded verbatim to `defaultTaskRunner`.
     *
     * Includes `remoteCache` (HTTP or REAPI gRPC backend), `cacheDirectory`,
     * `parallel`, `globalEnv`, `globalInputs`, `targetDefaults`, etc.
     * See `TaskRunnerOptions` for the full surface.
     */
    taskRunnerOptions?: Partial<TaskRunnerOptions>;

    /**
     * Toolchain (Node / pnpm / python / rust / ...) management. vis
     * delegates to whichever version manager (proto, mise, fnm, volta,
     * asdf, nvm, corepack) the developer already has — it does not ship
     * its own.
     *
     * Re-exported from `./toolchain` so the public config type stays
     * in lockstep with the resolver implementation. `self-activate` is
     * narrowed out of `preferredManager` here — it's auto-resolved for
     * pnpm/yarn `packageManager` pins and isn't meaningful as an
     * override.
     */
    toolchain?: Omit<InternalToolchainConfig, "preferredManager"> & {
        readonly preferredManager?: Exclude<VersionManagerName, "self-activate">;
    };
    /** Terminal UI configuration */
    tui?: {
        /**
         * Auto-exit the TUI after tasks complete.
         * - `false`: Stay open until the user presses `q` (default)
         * - `true`: Show quit dialog with 3-second countdown after completion
         * - `number`: Show quit dialog with custom countdown in seconds
         */
        autoExit?: boolean | number;
    };

    /** Update command defaults */
    update?: {
        /**
         * Dependency fields to scan for outdated packages.
         * Beyond the standard fields, supports:
         * - `"overrides"` (npm)
         * - `"resolutions"` (yarn)
         * - `"pnpm.overrides"`
         * @default ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
         */
        depFields?: string[];
        exclude?: string[];
        format?: "json" | "minimal" | "table";

        /**
         * Package names or glob patterns to permanently ignore during updates.
         * Ignored packages are skipped and listed in the output so you know
         * they were not checked.
         * @example ["eslint", "@types/*"]
         */
        ignore?: string[];
        include?: string[];

        /**
         * Include packages with pinned/exact versions (no `^` or `~` prefix).
         * By default, pinned versions are skipped during update checks.
         * @default false
         */
        includeLocked?: boolean;
        install?: boolean;

        /**
         * Maximum number of concurrent registry requests during outdated checks.
         * Higher values speed up large workspaces but risk hitting registry rate
         * limits or self-hosted Verdaccio caps.
         * @default 8
         */
        maxConcurrentRequests?: number;

        /**
         * Minimum number of minutes since a version was published before
         * vis will consider it for updates. This mirrors pnpm's
         * `minimumReleaseAge` — a single setting that applies to both
         * install and update.
         *
         * Not set by default. If your package manager config
         * (`pnpm-workspace.yaml`) has `minimumReleaseAge`, vis will
         * read it from there as a fallback.
         * @example 1440 // 24 hours
         */
        minimumReleaseAge?: number;

        /**
         * Package names/patterns excluded from the minimumReleaseAge check.
         * @example ["webpack", "@myorg/*"]
         */
        minimumReleaseAgeExclude?: string[];

        /**
         * Per-package or per-pattern update target overrides.
         * Keys are exact package names, glob patterns, or regex patterns
         * wrapped in `/` (e.g., `/^@vue/`).
         * Values are `"latest"`, `"minor"`, or `"patch"`.
         * @example { "typescript": "minor", "/^@vue/": "patch" }
         */
        packageMode?: Record<string, "latest" | "minor" | "patch">;
        prerelease?: boolean;

        /**
         * Which release channels to consider when picking the target version.
         * - `"stable"` (default) — only ship stable releases (no prereleases).
         * - `"same"` — match the prerelease channel of the *current* range:
         *   if you're on `react@19.0.0-rc.1`, only `rc.*` candidates qualify;
         *   if you're on a stable, only stable candidates. Prevents
         *   accidentally promoting a prerelease pin to a stable major bump.
         * - `"any"` — equivalent to `--prerelease`. Any channel is fair game.
         *
         * `--release-channel` on the CLI overrides this. If `prerelease: true`
         * is set without `releaseChannel`, vis treats it as `"any"`.
         * @default "stable"
         */
        releaseChannel?: "any" | "same" | "stable";
        security?: boolean;
        target?: "latest" | "minor" | "patch";
    };

    /**
     * Minimum vis CLI version required by this workspace. When the
     * running vis binary is older than this constraint, vis exits with
     * an actionable error before executing any command.
     *
     * Accepts a semver range string (e.g. `">=1.0.0"`, `"^1.2.0"`).
     * @example ">=1.0.0"
     */
    versionConstraint?: string;
}

/**
 * Extended project configuration exposed on the discovered workspace.
 * Adds vis-specific metadata (layer, stack, language, owners) on top of
 * the task-runner `ProjectConfiguration`.
 */
export interface VisProjectConfiguration extends ProjectConfiguration {
    /** Primary language identifier. */
    language?: string;
    /** Project layer classification (matches moon's layer hierarchy). */
    layer?: ProjectJson["layer"];
    /** Owners entries declared in project.json. */
    owners?: OwnersEntry[];
    /** Human-readable metadata block. */
    project?: ProjectJson["project"];
    /** Project stack classification. */
    stack?: ProjectJson["stack"];
    /** Raw targets with vis-specific options retained. */
    targets?: Record<string, TargetConfiguration>;
}

/**
 * Per-project options cache indexed by project name. Used by the run
 * command to read vis-specific target options without reparsing.
 */
export type ProjectOptionsIndex = Map<string, Record<string, VisTargetConfiguration>>;

/**
 * Parsed `package.json` files from the discovery pass, keyed by
 * project name. `buildProjectGraph` consumes this to avoid
 * re-parsing every `package.json` just to extract dependency info.
 */
export type PackageJsonIndex = Map<string, PackageJson>;

/**
 * Pre-loaded `vis.task.ts` overlays keyed by *relative* project
 * directory (the same key that `resolveWorkspacePatterns` returns).
 * Callers that want the overlay applied must produce this map before
 * calling `discoverWorkspace` — see `loadVisTaskConfigsForWorkspace`.
 */
export type VisTaskConfigIndex = Map<string, VisTaskConfig>;

export type { NativeAuditExclusions, PackageJson };
