import { isAccessibleSync, readFileSync, readJsonSync, walkSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import type {
    ConstraintsConfig,
    DependencyType,
    InputDefinition,
    NamedInputs,
    ProjectConfiguration,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    TargetConfiguration,
    WorkspaceConfiguration,
} from "@visulima/task-runner";

import type { VisPlugin } from "./hooks";
import type { StagedConfig } from "./staged";
import { mergeTargetWithInherit } from "./target-merge";
import type { VisTargetConfiguration } from "./target-options";
import { applyPreset, defaultCacheForType } from "./target-options";
import type { ToolchainConfig as InternalToolchainConfig, VersionManagerName } from "./toolchain";

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

    /** Task runner options */
    taskRunnerOptions?: Record<string, unknown>;

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

const TRAILING_SLASH_RE = /\/+$/;
const DOUBLE_GLOB_SUFFIX_RE = /\/\*\*$/;
const NESTED_GLOB_SUFFIX_RE = /\/\*\/\*$/;
const QUOTES_RE = /^['"]|['"]$/g;
const NODE_MODULES_RE = /node_modules/;
const DOT_GIT_RE = /\.git/;

/**
 * Reads and parses a JSON file, returning undefined on failure.
 */
const readJsonFileSafe = <T>(filePath: string): T | undefined => {
    try {
        return readJsonSync(filePath) as T;
    } catch {
        return undefined;
    }
};

/**
 * Recursively scans a directory for packages (directories containing package.json).
 */
const scanDirectoryRecursive = (baseDirectory: string, base: string, results: string[]): void => {
    for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
        if (entry.path === baseDirectory) {
            continue;
        }

        if (isAccessibleSync(join(entry.path, "package.json"))) {
            const relativePath = entry.path.slice(baseDirectory.length + 1);

            results.push(`${base}/${relativePath}`);
        }
    }
};

/**
 * Resolves a simple glob pattern like "packages/*" to directories containing package.json.
 */
const resolveSimpleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.slice(0, -2);
    const baseDirectory = resolve(workspaceRoot, base);

    if (!isAccessibleSync(baseDirectory)) {
        return;
    }

    for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, maxDepth: 1, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
        if (entry.path === baseDirectory) {
            continue;
        }

        if (isAccessibleSync(join(entry.path, "package.json"))) {
            results.push(join(base, entry.name));
        }
    }
};

/**
 * Resolves a double glob pattern like "packages/**" or "packages/ * / *" to directories containing package.json.
 */
const resolveDoubleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.replace(DOUBLE_GLOB_SUFFIX_RE, "").replace(NESTED_GLOB_SUFFIX_RE, "");
    const baseDirectory = resolve(workspaceRoot, base);

    if (!isAccessibleSync(baseDirectory)) {
        return;
    }

    scanDirectoryRecursive(baseDirectory, base, results);
};

/**
 * Resolves an exact directory pattern.
 */
const resolveExactDirectory = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const fullPath = resolve(workspaceRoot, cleanPattern);

    if (isAccessibleSync(fullPath) && isAccessibleSync(join(fullPath, "package.json"))) {
        results.push(cleanPattern);
    }
};

/**
 * Resolves glob-like workspace patterns to actual directories.
 * Supports simple patterns like "packages/*" and "packages/**".
 */
const resolveWorkspacePatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const directories: string[] = [];

    for (const pattern of patterns) {
        const cleanPattern = pattern.replace(TRAILING_SLASH_RE, "");

        if (cleanPattern.startsWith("!")) {
            continue;
        }

        if (cleanPattern.endsWith("/*")) {
            resolveSimpleGlob(workspaceRoot, cleanPattern, directories);
        } else if (cleanPattern.endsWith("/**") || cleanPattern.endsWith("/*/*")) {
            resolveDoubleGlob(workspaceRoot, cleanPattern, directories);
        } else {
            resolveExactDirectory(workspaceRoot, cleanPattern, directories);
        }
    }

    return directories;
};

/**
 * Reads workspace patterns from pnpm-workspace.yaml (simple parser).
 */

/**
 * Expands every `{ group: "name" }` entry in a target's `dependsOn`
 * into the group's declared members, recursively resolving nested
 * groups and detecting cycles.
 *
 * Runs once per workspace discovery so task-runner's graph builder
 * only ever sees bare dependency entries — groups are pure vis sugar.
 */
export const expandTaskGroups = (
    dependsOn: (string | { dependencies?: boolean; projects?: string | string[]; target: string } | { group: string })[] | undefined,
    groups: VisConfig["taskGroups"],
    seen: Set<string> = new Set(),
): (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] => {
    if (!dependsOn) {
        return [];
    }

    const expanded: (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] = [];

    for (const entry of dependsOn) {
        if (typeof entry === "object" && entry && "group" in entry) {
            const groupName = entry.group;

            if (seen.has(groupName)) {
                throw new Error(`Cycle detected in vis.config taskGroups: ${[...seen, groupName].join(" → ")}`);
            }

            const members = groups?.[groupName];

            if (!members) {
                throw new Error(`Unknown taskGroup "${groupName}" referenced in dependsOn. Declare it under \`taskGroups\` in vis.config.ts.`);
            }

            expanded.push(...expandTaskGroups(members, groups, new Set([...seen, groupName])));
            continue;
        }

        expanded.push(entry);
    }

    return expanded;
};

/**
 * Validates the root `package.json` `workspaces` field and returns the
 * resolved pattern array. Throws a clear diagnostic when the field is
 * malformed (empty array, wrong type, object without `packages`)
 * instead of falling through to a vague "no workspace configuration
 * found" error that hides the real problem.
 */
const validateWorkspacesField = (raw: PackageJson["workspaces"]): string[] => {
    if (Array.isArray(raw)) {
        if (raw.length === 0) {
            throw new Error('Invalid package.json `workspaces`: empty array. Add at least one pattern like "packages/*" or remove the field.');
        }

        for (const entry of raw) {
            if (typeof entry !== "string" || entry.trim().length === 0) {
                throw new TypeError(`Invalid package.json \`workspaces\` entry: expected a non-empty glob string, got ${JSON.stringify(entry)}.`);
            }
        }

        return raw;
    }

    if (raw && typeof raw === "object") {
        const { packages } = raw;

        if (packages === undefined) {
            throw new Error('Invalid package.json `workspaces`: object form requires a `packages` array (e.g. `{ "packages": ["packages/*"] }`).');
        }

        if (!Array.isArray(packages)) {
            throw new TypeError(`Invalid package.json \`workspaces.packages\`: expected an array of glob strings, got ${typeof packages}.`);
        }

        return validateWorkspacesField(packages);
    }

    throw new TypeError(`Invalid package.json \`workspaces\`: expected an array or { packages: string[] } object, got ${typeof raw}.`);
};

const readPnpmWorkspacePatterns = (workspaceRoot: string): string[] | undefined => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    const content = readFileSync(filePath);
    const patterns: string[] = [];
    let inPackages = false;

    for (const line of content.split("\n")) {
        const trimmed = line.trim();

        if (trimmed === "packages:") {
            inPackages = true;
            continue;
        }

        if (inPackages) {
            if (trimmed.startsWith("- ")) {
                const pattern = trimmed.slice(2).replaceAll(QUOTES_RE, "");

                patterns.push(pattern);
            } else if (trimmed && !trimmed.startsWith("#")) {
                break;
            }
        }
    }

    return patterns.length > 0 ? patterns : undefined;
};

const FILE_GROUP_PREFIX = "@filegroup:";

/**
 * Returns true if the named {@link TaskDefaultsBlock} scope matches the
 * given project metadata. Missing scope fields are treated as "any".
 */
const scopeMatches = (scope: TaskDefaultsScope | undefined, projectJson: ProjectJson | undefined, projectType: "application" | "library"): boolean => {
    if (!scope) {
        return true;
    }

    if (scope.projectType && scope.projectType !== projectType) {
        return false;
    }

    if (scope.tags && scope.tags.length > 0) {
        const projectTags = new Set(projectJson?.tags);
        const hasOverlap = scope.tags.some((tag) => projectTags.has(tag));

        if (!hasOverlap) {
            return false;
        }
    }

    if (scope.layer) {
        const needed = Array.isArray(scope.layer) ? scope.layer : [scope.layer];

        if (projectJson?.layer === undefined || !needed.includes(projectJson.layer)) {
            return false;
        }
    }

    if (scope.stack) {
        const needed = Array.isArray(scope.stack) ? scope.stack : [scope.stack];

        if (projectJson?.stack === undefined || !needed.includes(projectJson.stack)) {
            return false;
        }
    }

    if (scope.language) {
        const needed = Array.isArray(scope.language) ? scope.language : [scope.language];

        if (projectJson?.language === undefined || !needed.includes(projectJson.language)) {
            return false;
        }
    }

    return true;
};

/**
 * Returns the merged target defaults that apply to a project, combining
 * the flat `config.targetDefaults` with all matching `config.taskDefaults`
 * blocks in declaration order. Later entries override earlier ones.
 */
const collectTargetDefaults = (
    config: VisConfig,
    projectJson: ProjectJson | undefined,
    projectType: "application" | "library",
): Record<string, Partial<VisTargetConfiguration>> => {
    const merged: Record<string, Partial<VisTargetConfiguration>> = {};

    for (const [name, defaults] of Object.entries(config.targetDefaults ?? {})) {
        merged[name] = mergeTargetWithInherit(undefined, defaults);
    }

    for (const block of config.taskDefaults ?? []) {
        if (!scopeMatches(block.scope, projectJson, projectType)) {
            continue;
        }

        for (const [name, defaults] of Object.entries(block.targets)) {
            merged[name] = mergeTargetWithInherit(merged[name], defaults);
        }
    }

    return merged;
};

/**
 * Resolves `@filegroup:&lt;name>` tokens in an inputs array into their
 * concrete patterns defined at the workspace level.
 */
const resolveFileGroupInputs = (
    inputs: (string | InputDefinition)[] | undefined,
    fileGroups: Record<string, string[]> | undefined,
): (string | InputDefinition)[] | undefined => {
    if (!inputs) {
        return inputs;
    }

    const resolved: (string | InputDefinition)[] = [];

    for (const input of inputs) {
        if (typeof input === "string" && input.startsWith(FILE_GROUP_PREFIX)) {
            const groupName = input.slice(FILE_GROUP_PREFIX.length);
            const group = fileGroups?.[groupName];

            if (group) {
                resolved.push(...group);
            }

            continue;
        }

        resolved.push(input);
    }

    return resolved;
};

/**
 * Merges a script-derived target with any declarative target definition
 * from project.json and applies scoped defaults. Also applies presets and
 * default-cache-for-type logic.
 */
const mergeTarget = (
    _name: string,
    scriptCommand: string | undefined,
    projectTarget: VisTargetConfiguration | undefined,
    defaults: Partial<VisTargetConfiguration> | undefined,
    fileGroups: Record<string, string[]> | undefined,
): VisTargetConfiguration => {
    const merged = mergeTargetWithInherit(defaults, projectTarget);
    const base: VisTargetConfiguration = {
        ...merged,
        options: {
            ...defaults?.options,
            ...projectTarget?.options,
        },
    };

    if (scriptCommand && base.command === undefined && base.executor === undefined) {
        base.command = scriptCommand;
    }

    if (base.inputs) {
        base.inputs = resolveFileGroupInputs(base.inputs, fileGroups);
    }

    const withPreset = applyPreset(base);

    if (withPreset.cache === undefined) {
        withPreset.cache = defaultCacheForType(withPreset.type);
    }

    return withPreset;
};

/**
 * Creates script-based targets from package.json scripts, merging any
 * matching project.json target declaration + scoped defaults + file groups.
 */
const createTargetsFromScripts = (
    scripts: Record<string, string> | undefined,
    projectTargets: Record<string, VisTargetConfiguration> | undefined,
    defaults: Record<string, Partial<VisTargetConfiguration>>,
    fileGroups: Record<string, string[]> | undefined,
): Record<string, VisTargetConfiguration> => {
    const targets: Record<string, VisTargetConfiguration> = {};
    const seen = new Set<string>();

    for (const [name, command] of Object.entries(scripts ?? {})) {
        seen.add(name);
        targets[name] = mergeTarget(name, command, projectTargets?.[name], defaults[name], fileGroups);
    }

    for (const [name, projectTarget] of Object.entries(projectTargets ?? {})) {
        if (seen.has(name)) {
            continue;
        }

        targets[name] = mergeTarget(name, undefined, projectTarget, defaults[name], fileGroups);
    }

    return targets;
};

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
 * project name. {@link buildProjectGraph} consumes this to avoid
 * re-parsing every `package.json` just to extract dependency info.
 */
export type PackageJsonIndex = Map<string, PackageJson>;

/**
 * Pre-loaded `vis.task.ts` overlays keyed by *relative* project
 * directory (the same key that {@link resolveWorkspacePatterns} returns).
 * Callers that want the overlay applied must produce this map before
 * calling {@link discoverWorkspace} — see `loadVisTaskConfigsForWorkspace`.
 */
export type VisTaskConfigIndex = Map<string, VisTaskConfig>;

/**
 * Merge per-project targets from `project.json` with the per-package
 * `vis.task.ts` overlay. The overlay wins per-target via
 * {@link mergeTargetWithInherit}, which honours the `@inherit` sentinel.
 */
const mergeProjectTargets = (
    projectJsonTargets: Record<string, VisTargetConfiguration> | undefined,
    visTaskTargets: Record<string, VisTargetConfiguration> | undefined,
): Record<string, VisTargetConfiguration> | undefined => {
    if (projectJsonTargets === undefined && visTaskTargets === undefined) {
        return undefined;
    }

    const names = new Set<string>([...Object.keys(projectJsonTargets ?? {}), ...Object.keys(visTaskTargets ?? {})]);
    const out: Record<string, VisTargetConfiguration> = {};

    for (const name of names) {
        out[name] = mergeTargetWithInherit(projectJsonTargets?.[name], visTaskTargets?.[name]) as VisTargetConfiguration;
    }

    return out;
};

/**
 * Discovers all projects in the workspace and builds a WorkspaceConfiguration.
 */
const discoverWorkspace = (
    workspaceRoot: string,
    config: VisConfig = {},
    taskConfigs?: VisTaskConfigIndex,
): {
    config: VisConfig;
    packageJsons: PackageJsonIndex;
    projectOptions: ProjectOptionsIndex;
    workspace: WorkspaceConfiguration;
} => {
    const projects: Record<string, VisProjectConfiguration> = {};
    const projectOptions: ProjectOptionsIndex = new Map();
    const packageJsons: PackageJsonIndex = new Map();

    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces !== undefined) {
        workspacePatterns = validateWorkspacesField(rootPkg.workspaces);
    }

    if (!workspacePatterns) {
        throw new Error("No workspace configuration found. Expected pnpm-workspace.yaml or package.json workspaces field.");
    }

    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);

    for (const projectDirectory of projectDirectories) {
        const packageJsonPath = join(workspaceRoot, projectDirectory, "package.json");
        const pkg = readJsonFileSafe<PackageJson>(packageJsonPath);

        if (!pkg?.name) {
            continue;
        }

        packageJsons.set(pkg.name, pkg);

        const projectJsonPath = join(workspaceRoot, projectDirectory, "project.json");
        const projectJson = readJsonFileSafe<ProjectJson>(projectJsonPath);

        let projectType: "application" | "library" = "library";

        if (projectJson?.projectType) {
            projectType = projectJson.projectType;
        } else if (pkg.bin !== undefined) {
            projectType = "application";
        }

        const defaults = collectTargetDefaults(config, projectJson, projectType);

        const overlayTargets = mergeProjectTargets(projectJson?.targets, taskConfigs?.get(projectDirectory)?.targets);
        const visTargets = createTargetsFromScripts(pkg.scripts, overlayTargets, defaults, config.fileGroups);

        projectOptions.set(pkg.name, visTargets);

        const sanitizedTargets: Record<string, TargetConfiguration> = {};

        for (const [targetName, target] of Object.entries(visTargets)) {
            const { options, preset: _preset, type: _type, ...rest } = target;
            const expandedDependsOn = target.dependsOn
                ? expandTaskGroups(target.dependsOn as Parameters<typeof expandTaskGroups>[0], config.taskGroups)
                : undefined;

            sanitizedTargets[targetName] = {
                ...rest,
                ...(expandedDependsOn ? { dependsOn: expandedDependsOn } : {}),
                ...(options ? { options: options as unknown as Record<string, unknown> } : {}),
            };
        }

        projects[pkg.name] = {
            implicitDependencies: projectJson?.implicitDependencies,
            language: projectJson?.language,
            layer: projectJson?.layer,
            owners: projectJson?.owners,
            project: projectJson?.project,
            projectType,
            root: projectDirectory,
            sourceRoot: projectJson?.sourceRoot ?? `${projectDirectory}/src`,
            stack: projectJson?.stack,
            tags: projectJson?.tags,
            targets: sanitizedTargets,
        };
    }

    return { config, packageJsons, projectOptions, workspace: { projects } };
};

/**
 * Builds the project dependency graph from package.json dependencies.
 *
 * If `packageJsons` is provided (e.g. from {@link discoverWorkspace}),
 * each project's `package.json` is reused from memory instead of
 * re-read + re-parsed off disk — on a 40-project monorepo that's 40
 * fewer reads per `vis run`.
 */
const buildProjectGraph = (workspaceRoot: string, workspace: WorkspaceConfiguration, packageJsons?: PackageJsonIndex): ProjectGraph => {
    const nodes: Record<string, ProjectGraphProjectNode> = {};
    const dependencies: Record<string, ProjectGraphDependency[]> = {};
    const projectNames = new Set(Object.keys(workspace.projects));

    for (const [name, config] of Object.entries(workspace.projects)) {
        nodes[name] = {
            data: config,
            name,
            type: config.projectType ?? "library",
        };

        dependencies[name] = [];

        const pkg = packageJsons?.get(name) ?? readJsonFileSafe<PackageJson>(join(workspaceRoot, config.root, "package.json"));

        if (!pkg) {
            continue;
        }

        const depSources: [Record<string, string> | undefined, DependencyType][] = [
            [pkg.dependencies, "static"],
            [pkg.devDependencies, "devDependency"],
            [pkg.peerDependencies, "peerDependency"],
        ];

        const seen = new Set<string>();

        for (const [deps, depType] of depSources) {
            if (!deps) {
                continue;
            }

            for (const depName of Object.keys(deps)) {
                if (projectNames.has(depName) && !seen.has(depName)) {
                    seen.add(depName);
                    dependencies[name]?.push({
                        source: name,
                        target: depName,
                        type: depType,
                    });
                }
            }
        }
    }

    return { dependencies, nodes };
};

/**
 * Pre-load every project's `vis.task.ts` overlay in parallel. Returns
 * a {@link VisTaskConfigIndex} keyed by relative project directory, ready
 * to pass into {@link discoverWorkspace}.
 *
 * This pre-pass is the bridge between sync `discoverWorkspace` and the
 * async overlay loader — callers that want overlay support load this
 * once up front, callers that don't simply omit the third argument and
 * keep the legacy "no overlay" behaviour.
 */
const loadVisTaskConfigsForWorkspace = async (workspaceRoot: string): Promise<VisTaskConfigIndex> => {
    const { loadVisTaskConfig } = await import("./config");
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces !== undefined) {
        workspacePatterns = validateWorkspacesField(rootPkg.workspaces);
    }

    if (!workspacePatterns) {
        return new Map();
    }

    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);
    const result: VisTaskConfigIndex = new Map();

    await Promise.all(
        projectDirectories.map(async (projectDirectory) => {
            const pkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, projectDirectory, "package.json"));

            if (!pkg?.name) {
                return;
            }

            const overlay = await loadVisTaskConfig(workspaceRoot, join(workspaceRoot, projectDirectory), pkg.name);

            if (overlay !== undefined) {
                result.set(projectDirectory, overlay);
            }
        }),
    );

    return result;
};

export type { PackageJson, VisConfig };
// VisTaskConfig is exported via its `export interface` declaration above.
export {
    buildProjectGraph,
    collectTargetDefaults,
    discoverWorkspace,
    loadVisTaskConfigsForWorkspace,
    readPnpmWorkspacePatterns,
    resolveWorkspacePatterns,
    scopeMatches,
    validateWorkspacesField,
};

export { type StagedConfig } from "./staged";
