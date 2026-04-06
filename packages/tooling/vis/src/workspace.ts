import { isAccessibleSync, readFileSync, readJsonSync, walkSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import type {
    ConstraintsConfig,
    DependencyType,
    ProjectConfiguration,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    TargetConfiguration,
    WorkspaceConfiguration,
} from "@visulima/task-runner";
import type { Configuration as StagedConfig } from "lint-staged";

interface PackageJson {
    bin?: Record<string, string> | string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    workspaces?: string[] | { catalog?: Record<string, string>; packages?: string[] };
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
    /** Package override mappings applied during migration (e.g., `{ "lodash": "lodash-es" }`) */
    overrides?: Record<string, string>;

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
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** Task runner options */
    taskRunnerOptions?: Record<string, unknown>;
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
        install?: boolean;
        prerelease?: boolean;
        security?: boolean;
        target?: "latest" | "minor" | "patch";
    };
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

/**
 * Creates script-based targets from package.json scripts.
 */
const createTargetsFromScripts = (
    scripts: Record<string, string>,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Record<string, TargetConfiguration> => {
    const targets: Record<string, TargetConfiguration> = {};

    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
        const defaults = targetDefaults?.[scriptName];

        targets[scriptName] = {
            ...defaults,
            command: scriptCommand,
        };
    }

    return targets;
};

/**
 * Discovers all projects in the workspace and builds a WorkspaceConfiguration.
 */
const discoverWorkspace = (workspaceRoot: string, config: VisConfig = {}): { config: VisConfig; workspace: WorkspaceConfiguration } => {
    const projects: Record<string, ProjectConfiguration> = {};

    // Find workspace patterns
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces) {
        workspacePatterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages;
    }

    if (!workspacePatterns) {
        throw new Error("No workspace configuration found. Expected pnpm-workspace.yaml or package.json workspaces field.");
    }

    // Resolve patterns to actual project directories
    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);

    for (const projectDirectory of projectDirectories) {
        const packageJsonPath = join(workspaceRoot, projectDirectory, "package.json");
        const pkg = readJsonFileSafe<PackageJson>(packageJsonPath);

        if (!pkg?.name) {
            continue;
        }

        // Check for project.json for additional configuration
        const projectJsonPath = join(workspaceRoot, projectDirectory, "project.json");
        const projectJson = readJsonFileSafe<{ projectType?: "application" | "library"; sourceRoot?: string; tags?: string[] }>(projectJsonPath);

        const targets = pkg.scripts ? createTargetsFromScripts(pkg.scripts, config.targetDefaults) : {};

        // Determine project type: explicit project.json > bin heuristic > default
        let projectType: "application" | "library" = "library";

        if (projectJson?.projectType) {
            projectType = projectJson.projectType;
        } else if (pkg.bin !== undefined) {
            // Packages with bin entries are typically applications/CLIs
            projectType = "application";
        }

        projects[pkg.name] = {
            projectType,
            root: projectDirectory,
            sourceRoot: projectJson?.sourceRoot ?? `${projectDirectory}/src`,
            tags: projectJson?.tags,
            targets,
        };
    }

    return { config, workspace: { projects } };
};

/**
 * Builds the project dependency graph from package.json dependencies.
 */
const buildProjectGraph = (workspaceRoot: string, workspace: WorkspaceConfiguration): ProjectGraph => {
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

        // Read the package.json to find dependencies
        const pkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, config.root, "package.json"));

        if (!pkg) {
            continue;
        }

        // Track each dependency source separately to preserve the relationship type
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
                // Only include workspace-internal dependencies, skip duplicates across sources
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

export type { PackageJson, VisConfig };
export { buildProjectGraph, discoverWorkspace, readPnpmWorkspacePatterns, resolveWorkspacePatterns };

export { type Configuration as StagedConfig } from "lint-staged";
