import type { ConstraintsConfig, NamedInputs, ProjectConfiguration, TargetConfiguration, TaskRunnerOptions } from "@visulima/task-runner";

import type { ToolchainConfig as InternalToolchainConfig, VersionManagerName } from "../runtime/toolchain";
import type { StagedConfig } from "../staged";
import type { VisTargetConfiguration } from "../task/target-options";
import type { VisPlugin } from "../util/hooks";

// ── audit-config types ─────────────────────────────────────────────

interface NativeAuditExclusions {
    /** Package names to exclude from audit (yarn berry only). */
    excludedPackages: string[];
    /** Advisory IDs to ignore (CVE-*, GHSA-*, or numeric IDs). */
    ignoredAdvisories: string[];
}

// ── workspace types ────────────────────────────────────────────────

export interface CodeownersConfig {
    /** Workspace-level paths that apply outside any project (e.g., `.github/**`). */
    globalPaths?: Record<string, string[]>;
    /** Sort order for generated entries — mirrors moon's `orderBy`. */
    orderBy?: "file-source" | "project-id";
    /** Provider determines whether `channel` is emitted (GitHub supports it via comment). */
    provider?: "bitbucket" | "github" | "gitlab" | "other";
}

interface PackageJson {
    bin?: Record<string, string> | string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
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
    /** Project type — library or application. */
    projectType?: "application" | "library";
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
    projectType?: "application" | "library";
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

interface VisConfig {
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
     * Install via `npm i -g @endevco/aube`, `mise use -g aube`, or
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
         * Map of package names/patterns to allow (true) or deny (false) build scripts.
         * Packages not listed are denied by default.
         * Equivalent to pnpm's `allowBuilds` setting.
         * @example
         * ```
         * allowBuilds: {
         *   "esbuild": true,
         *   "core-js": false,
         *   "@prisma/client": true,
         * }
         * ```
         */
        allowBuilds?: Record<string, boolean>;

        /**
         * When true, prevents transitive dependencies from using exotic sources
         * (git repositories, direct tarball URLs). Only direct dependencies may
         * use such sources. Equivalent to pnpm's `blockExoticSubdeps`.
         * @default false
         */
        blockExoticSubdeps?: boolean;

        /**
         * Minimum number of minutes that must pass after a version is published
         * before vis will allow installation. Reduces risk of installing
         * compromised packages that are typically discovered within hours.
         * Equivalent to pnpm's `minimumReleaseAge`.
         * @default 0
         * @example 1440 // 24 hours
         */
        minimumReleaseAge?: number;

        /**
         * Package names/patterns excluded from minimumReleaseAge check.
         * Equivalent to pnpm's `minimumReleaseAgeExclude`.
         * @example ["webpack", "react", "@myorg/*"]
         */
        minimumReleaseAgeExclude?: string[];

        /**
         * Socket.dev security intelligence configuration.
         * When enabled, vis fetches package security scores, alerts, and report
         * data from the Socket.dev API during install, update, and check commands.
         * @see https://socket.dev
         */
        socket?: {
            /**
             * Packages whose low Socket.dev scores or alerts have been reviewed
             * and explicitly accepted. These packages skip the confirmation
             * prompt during `vis add` and show as "acknowledged" in `vis audit`.
             *
             * Key format: package name (`"lodash"`), name@version
             * (`"lodash@4.17.21"`), or glob (`"@myorg/*"`).
             * Unversioned keys match all versions of that package.
             * @example
             * ```
             * acceptedRisks: {
             *   "some-risky-pkg": {
             *     reason: "Internal fork, low score expected",
             *     acceptedAt: "2026-03-15T10:00:00Z",
             *     acceptedScore: 0.25,
             *   },
             * }
             * ```
             */
            acceptedRisks?: Record<
                string,
                {
                    /** ISO 8601 timestamp when the risk was accepted. */
                    acceptedAt: string;
                    /** The overall Socket.dev score at the time of acceptance. */
                    acceptedScore: number;
                    /** User-provided reason for accepting the risk. */
                    reason: string;
                }
            >;

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
             * Minimum overall Socket.dev score (0–1) for a package to be
             * accepted without a confirmation prompt during `vis add`.
             * Packages scoring below this threshold trigger an interactive
             * prompt asking the user to confirm. Set to 0 to disable.
             * @default 0.4
             */
            minimumScore?: number;

            /**
             * Request timeout in milliseconds for the Socket.dev API.
             * @default 15_000 (15 seconds)
             */
            timeoutMs?: number;
        };

        /**
         * When true, installation will fail (exit non-zero) if any dependencies
         * have unreviewed build scripts. Equivalent to pnpm's `strictDepBuilds`.
         * @default false
         */
        strictDepBuilds?: boolean;

        /**
         * Trust level checking for package publishing.
         * - "off": No trust checking (default)
         * - "no-downgrade": Fail if a package's trust level has decreased
         *   compared to previous releases (e.g., was published by trusted
         *   publisher, now only has provenance).
         * Equivalent to pnpm's `trustPolicy`.
         * @default "off"
         */
        trustPolicy?: "no-downgrade" | "off";

        /**
         * Package selectors excluded from trust policy checks.
         * Equivalent to pnpm's `trustPolicyExclude`.
         * @example ["chokidar@4.0.3", "@babel/core@7.28.5"]
         */
        trustPolicyExclude?: string[];

        /**
         * Ignore the trust policy check for packages published more than
         * the specified number of minutes ago. Useful for older packages
         * that pre-date provenance support.
         * Equivalent to pnpm's `trustPolicyIgnoreAfter` (10.27+).
         * @example 43200 // 30 days
         */
        trustPolicyIgnoreAfter?: number;

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
     * relocated from `&lt;linkedRoot>/.task-runner-cache` to the *main*
     * worktree's `.task-runner-cache`. Multiple parallel agents working in
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
        /** Alphabetize script commands (default: false) */
        sortScripts?: boolean;
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

export type { NativeAuditExclusions, PackageJson, VisConfig };
