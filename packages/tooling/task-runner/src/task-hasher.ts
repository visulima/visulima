import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

import type { Xxh3Hasher } from "@shared/xxh3";
// eslint-disable-next-line import/no-extraneous-dependencies -- bundled inline by packem from workspace devDependency
import { createXxh3Hasher, xxh3Hash } from "@shared/xxh3";
import { join, relative, resolve } from "@visulima/path";

import { getFrameworkEnvVariables } from "./framework-inference";
import type { IncrementalFileHasher } from "./incremental-hasher";
import { LockfileHasher } from "./lockfile-hasher";
import { loadNativeBindings } from "./native-binding";
import { looksLikeInputUri, parseInputUri } from "./parse-input-uri";
import type {
    EnvironmentInput,
    ExternalDependencyInput,
    FileSetInput,
    InputDefinition,
    NamedInputs,
    ProjectConfiguration,
    RuntimeInput,
    TargetConfiguration,
    Task,
    TaskHashDetails,
} from "./types";
import { collectFiles, hashStrings, sortObjectKeys } from "./utils";

/**
 * Interface for task hashers.
 */
interface TaskHasher {
    hashTask: (task: Task) => Promise<TaskHashDetails>;

    /**
     * Rehashes a single file bypassing any in-memory cache. Optional to keep
     * external/custom hashers backward compatible; the orchestrator skips
     * self-modifying-task detection when the implementation is absent.
     */
    rehashFile?: (filePath: string) => Promise<string | undefined>;
}

/**
 * Options for creating an InProcessTaskHasher.
 */
interface TaskHasherOptions {
    /**
     * When true, scan each task's resolved command for `$VAR`/`${VAR}`
     * references and auto-fingerprint them. Catches the common case of
     * a script reading `$VERCEL_URL` or `${NEXT_PUBLIC_API}` without
     * the user remembering to declare it in `envVars`/`globalEnv`.
     * @default false
     */
    autoEnvVars?: boolean;

    /** Additional environment variables to include in hash */
    envVars?: string[];

    /**
     * Enable framework environment variable inference.
     * When true, auto-detects frameworks and includes their public
     * env var prefixes in the task hash.
     * @default false
     */
    frameworkInference?: boolean;

    /**
     * Global environment variables that invalidate all task hashes.
     */
    globalEnv?: string[];

    /**
     * Global input files that invalidate all task hashes when changed.
     * These are workspace-root-relative paths (e.g., "pnpm-lock.yaml").
     */
    globalInputs?: string[];

    /**
     * Optional persistent mtime/size-indexed file snapshot. When set,
     * `#hashFile` consults the snapshot first and only re-reads file
     * contents when the file's mtime or size has changed since the
     * previous run. Cuts cold-cache fingerprint time dramatically on
     * large workspaces where most source files don't change run-to-run.
     *
     * The caller is responsible for `load()`ing the snapshot before
     * using the hasher and `save()`ing it after the run completes.
     */
    incrementalHasher?: IncrementalFileHasher;
    /** Named input definitions */
    namedInputs?: NamedInputs;
    /** Project configurations keyed by project name */
    projects: Record<string, ProjectConfiguration>;

    /**
     * Enable smart lockfile hashing.
     * When true, instead of hashing the entire lockfile, only the resolved
     * versions of a package's actual dependencies are hashed.
     * This means changing the lockfile only busts cache for affected packages.
     *
     * Matches Turborepo's smart lockfile hashing behavior.
     * @default false
     */
    smartLockfileHashing?: boolean;
    /** Target default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** The workspace root directory */
    workspaceRoot: string;
}

const DEFAULT_GLOBAL_INPUTS = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.base.json", "tsconfig.json", ".env"];

const IGNORED_DIRS = new Set([".git", "coverage", "dist", "node_modules"]);

const LOCKFILE_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

// Cache native bindings at module level for computeTaskHash
let cachedNative: ReturnType<typeof loadNativeBindings> | undefined;

const getNativeBindings = () => {
    if (cachedNative === undefined) {
        cachedNative = loadNativeBindings();
    }

    return cachedNative;
};

/**
 * Hashes sorted entries of a Record into a Hash object.
 */
const hashSortedEntries = (hash: Xxh3Hasher, record: Record<string, string>, prefix?: string): void => {
    for (const key of Object.keys(record).toSorted()) {
        if (prefix) {
            hash.update(`${prefix}${key}\0`);
        } else {
            hash.update(`${key}\0`);
        }

        hash.update(record[key] as string);
    }
};

/**
 * Executes a runtime command and returns its output for hashing.
 * Well-known commands (node -v) are handled inline for speed.
 */
const executeRuntimeCommand = (runtime: string): Promise<string> => {
    if (runtime === "node -v" || runtime === "node --version") {
        return Promise.resolve(process.version);
    }

    const parts = runtime.split(/\s+/);
    const command = parts[0] as string;
    const args = parts.slice(1);

    return new Promise((resolve) => {
        execFile(command, args, { timeout: 10_000 }, (error, stdout) => {
            if (error) {
                // If the command fails, use a sentinel value so the hash
                // is stable (but different from any successful output)
                resolve(`__runtime_error__:${runtime}`);
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

/** Cache for runtime command results (they don't change within a run) */
const runtimeCache = new Map<string, string>();

const hashRuntimeValue = async (runtime: string): Promise<string> => {
    let output = runtimeCache.get(runtime);

    if (output === undefined) {
        output = await executeRuntimeCommand(runtime);
        runtimeCache.set(runtime, output);
    }

    return hashStrings(runtime, output);
};

/** Shell positional / special variables that are never real env state. */
const SHELL_SPECIAL_VARS = new Set(["0", "!", "#", "$", "*", "-", "?", "@", "_"]);

/**
 * Extracts the names of environment variables referenced inside a
 * shell command. Matches `$FOO` and `${FOO}` (including parameter
 * expansions like `${FOO:-default}` — everything after the first
 * operator is stripped). Skips positional args (`$1`, `$2`, …) and
 * shell specials (`$?`, `$@`, …) since those aren't environment state.
 */
const extractReferencedEnvVars = (command: string): string[] => {
    const found = new Set<string>();
    const pattern = /\$(?:\{([^}]+)\}|([A-Z_]\w*))/gi;

    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign -- regex.exec loop is idiomatic
    while ((match = pattern.exec(command)) !== null) {
        const raw = match[1] ?? match[2];

        if (!raw) {
            continue;
        }

        const name = raw.split(/[#%:/?+\-=,^]/)[0]?.trim();

        if (!name || SHELL_SPECIAL_VARS.has(name) || /^\d+$/.test(name)) {
            continue;
        }

        if (!/^[A-Z_]\w*$/i.test(name)) {
            continue;
        }

        found.add(name);
    }

    return [...found];
};

// Type guards
const isFileSetInput = (input: InputDefinition): input is FileSetInput => "fileset" in input;

/**
 * Normalizes a fileset entry into a string pattern that uses
 * `{projectRoot}` / `{workspaceRoot}` tokens for downstream resolution.
 *
 * - Bare strings are returned unchanged.
 * - Object form `{ pattern, base: "workspace" }` → `{workspaceRoot}/&lt;pattern>`
 *   (or `!{workspaceRoot}/...` when `pattern` starts with `!`).
 * - Object form `{ pattern, base: "package" }` → `{projectRoot}/&lt;pattern>`.
 */
const normalizeFileset = (fileset: FileSetInput["fileset"]): string => {
    if (typeof fileset === "string") {
        return fileset;
    }

    const token = fileset.base === "workspace" ? "{workspaceRoot}" : "{projectRoot}";

    if (fileset.pattern.startsWith("!")) {
        return `!${token}/${fileset.pattern.slice(1)}`;
    }

    return `${token}/${fileset.pattern}`;
};

const isRuntimeInput = (input: InputDefinition): input is RuntimeInput => "runtime" in input;

const isEnvironmentInput = (input: InputDefinition): input is EnvironmentInput => "env" in input;

const isExternalDependencyInput = (input: InputDefinition): input is ExternalDependencyInput => "externalDependencies" in input;

/**
 * Computes hashes for tasks based on their inputs.
 * Used to determine if a cached result can be reused.
 */
class InProcessTaskHasher implements TaskHasher {
    readonly #workspaceRoot: string;

    readonly #projects: Record<string, ProjectConfiguration>;

    readonly #namedInputs: NamedInputs;

    readonly #targetDefaults: Record<string, Partial<TargetConfiguration>>;

    readonly #envVars: string[];

    readonly #globalInputs: string[];

    readonly #globalEnv: string[];

    readonly #fileHashCache = new Map<string, string>();

    readonly #native: ReturnType<typeof loadNativeBindings>;

    readonly #smartLockfileHashing: boolean;

    readonly #lockfileHasher: LockfileHasher | undefined;

    readonly #frameworkInference: boolean;

    readonly #autoEnvVars: boolean;

    readonly #incrementalHasher: IncrementalFileHasher | undefined;

    #globalHash: string | undefined = undefined;

    public constructor(options: TaskHasherOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#projects = options.projects;
        this.#namedInputs = options.namedInputs ?? {};
        this.#targetDefaults = options.targetDefaults ?? {};
        this.#envVars = options.envVars ?? [];
        this.#globalInputs = options.globalInputs ?? DEFAULT_GLOBAL_INPUTS;
        this.#globalEnv = options.globalEnv ?? [];
        this.#native = getNativeBindings();
        this.#smartLockfileHashing = options.smartLockfileHashing ?? false;
        this.#lockfileHasher = this.#smartLockfileHashing ? new LockfileHasher(options.workspaceRoot) : undefined;
        this.#frameworkInference = options.frameworkInference ?? false;
        this.#autoEnvVars = options.autoEnvVars ?? false;
        this.#incrementalHasher = options.incrementalHasher;
    }

    public async hashTask(task: Task): Promise<TaskHashDetails> {
        const commandHash = this.#hashCommand(task);
        const nodes: Record<string, string> = {};
        const implicitDeps: Record<string, string> = {};
        const runtime: Record<string, string> = {};

        const globalHash = await this.#computeGlobalHash();

        if (globalHash) {
            implicitDeps["__global__"] = globalHash;
        }

        const inputs = this.#resolveInputs(task);
        const negationPatterns = this.#collectNegationPatterns(inputs, task.target.project);

        for (const input of inputs) {
            if (isFileSetInput(input)) {
                // eslint-disable-next-line no-await-in-loop -- filesets must be processed sequentially to accumulate into shared nodes/runtime maps
                const fileHashes = await this.#hashFileSet(task, normalizeFileset(input.fileset), negationPatterns);

                for (const [filePath, hash] of Object.entries(fileHashes)) {
                    nodes[filePath] = hash;
                }
            } else if (isRuntimeInput(input)) {
                // eslint-disable-next-line no-await-in-loop -- runtime inputs processed within sequential input loop
                runtime[input.runtime] = await hashRuntimeValue(input.runtime);
            } else if (isEnvironmentInput(input)) {
                runtime[`env:${input.env}`] = hashStrings(input.env, process.env[input.env] ?? "");
            } else if (isExternalDependencyInput(input)) {
                // eslint-disable-next-line no-await-in-loop -- external dependencies processed within sequential input loop
                const depHashes = await Promise.all(input.externalDependencies.map(async (dep) => [dep, await this.#hashExternalDependency(dep)] as const));

                for (const [dep, hash] of depHashes) {
                    implicitDeps[dep] = hash;
                }
            }
        }

        for (const envVariable of this.#envVars) {
            runtime[`env:${envVariable}`] = hashStrings(envVariable, process.env[envVariable] ?? "");
        }

        // Auto-fingerprint env vars referenced in the task's command
        // text. Scripts like `curl ${VERCEL_URL}/api` start busting
        // cache when VERCEL_URL changes without the user having to
        // declare it in `envVars`/`globalEnv`.
        if (this.#autoEnvVars) {
            const command = this.#resolveCommandText(task);

            if (command) {
                for (const name of extractReferencedEnvVars(command)) {
                    const key = `env:${name}`;

                    // Don't overwrite if the user already declared it.
                    if (runtime[key] === undefined) {
                        runtime[key] = hashStrings(name, process.env[name] ?? "");
                    }
                }
            }
        }

        // Hoist project lookup once for lockfile + framework features
        const project = this.#projects[task.target.project];

        if (project) {
            if (this.#lockfileHasher) {
                const lockfileHash = await this.#lockfileHasher.hashForPackage(join(project.root, "package.json"));

                if (lockfileHash) {
                    implicitDeps["__lockfile__"] = lockfileHash.hash;
                }
            }

            if (this.#frameworkInference) {
                const packageJsonPath = resolve(this.#workspaceRoot, project.root, "package.json");
                const frameworkEnvVariables = await getFrameworkEnvVariables(packageJsonPath);

                for (const envName of Object.keys(frameworkEnvVariables)) {
                    runtime[`framework-env:${envName}`] = hashStrings(envName, process.env[envName] ?? "");
                }
            }
        }

        return {
            command: commandHash,
            implicitDeps: Object.keys(implicitDeps).length > 0 ? implicitDeps : undefined,
            nodes,
            runtime: Object.keys(runtime).length > 0 ? runtime : undefined,
        };
    }

    /**
     * Hashes the command identity for a task using xxh3-128.
     * Uses native Rust implementation when available, otherwise pure TS xxh3-ts.
     * Both produce identical xxh3-128 output.
     */
    #hashCommand(task: Task): string {
        const overridesJson = JSON.stringify(sortObjectKeys(task.overrides));

        if (this.#native) {
            return this.#native.hashCommand(task.target.project, task.target.target, task.target.configuration ?? undefined, overridesJson);
        }

        const hash = createXxh3Hasher();

        hash.update(task.target.project);
        hash.update(task.target.target);

        if (task.target.configuration) {
            hash.update(task.target.configuration);
        }

        hash.update(overridesJson);

        return hash.digest();
    }

    /**
     * Looks up the command string associated with a task so referenced
     * env vars can be extracted. Checks `task.overrides.command` first
     * (consumers like vis stash the resolved command there), then falls
     * back to the project's target config.
     */
    #resolveCommandText(task: Task): string | undefined {
        const override = task.overrides["command"];

        if (typeof override === "string") {
            return override;
        }

        const project = this.#projects[task.target.project];
        const command = project?.targets?.[task.target.target]?.command ?? this.#targetDefaults[task.target.target]?.command;

        return typeof command === "string" ? command : undefined;
    }

    #resolveInputs(task: Task): InputDefinition[] {
        const project = this.#projects[task.target.project];
        const targetConfig = project?.targets?.[task.target.target];
        const defaultConfig = this.#targetDefaults[task.target.target];
        const rawInputs = targetConfig?.inputs ?? defaultConfig?.inputs;

        if (!rawInputs) {
            return [{ fileset: "{projectRoot}/**/*" }];
        }

        return this.#expandInputs(rawInputs, task.target.project);
    }

    #expandInputs(inputs: (string | InputDefinition)[], projectName: string): InputDefinition[] {
        const result: InputDefinition[] = [];
        const seen = new Set<string>();

        for (const input of inputs) {
            if (typeof input === "string") {
                if (looksLikeInputUri(input)) {
                    const parsed = parseInputUri(input);

                    if (parsed) {
                        result.push(parsed);
                    }
                } else if (input.startsWith("{") || input.startsWith("!{")) {
                    result.push({ fileset: input });
                } else if (input.startsWith("^")) {
                    continue;
                } else if (this.#namedInputs[input] && !seen.has(input)) {
                    seen.add(input);
                    result.push(...this.#expandInputs(this.#namedInputs[input], projectName));
                } else {
                    result.push({ fileset: input });
                }
            } else {
                result.push(input);
            }
        }

        return result;
    }

    #collectNegationPatterns(inputs: InputDefinition[], projectName: string): string[] {
        const project = this.#projects[projectName];
        const projectRoot = project?.root ?? "";
        const patterns: string[] = [];

        for (const input of inputs) {
            if (!isFileSetInput(input)) {
                continue;
            }

            const resolved = normalizeFileset(input.fileset).replace("{projectRoot}", projectRoot).replace("{workspaceRoot}", ".");

            if (resolved.startsWith("!")) {
                patterns.push(
                    resolved
                        .slice(1)
                        .replace(/\/\*\*\/\*$/, "")
                        .replace(/\/\*$/, ""),
                );
            }
        }

        return patterns;
    }

    /**
     * Hashes all files matching a fileset pattern.
     * Uses native Rust parallel hashing (via rayon) when available.
     */
    async #hashFileSet(task: Task, pattern: string, negationPatterns: string[] = []): Promise<Record<string, string>> {
        const project = this.#projects[task.target.project];
        const projectRoot = project?.root ?? "";

        const resolvedPattern = pattern.replace("{projectRoot}", projectRoot).replace("{workspaceRoot}", ".");

        if (resolvedPattern.startsWith("!")) {
            // Negation patterns are collected and applied by the caller
            return {};
        }

        const absoluteBase = resolve(this.#workspaceRoot, resolvedPattern.replace(/\/\*\*\/\*$/, "").replace(/\/\*$/, ""));
        const absoluteNegations = negationPatterns.map((p) => resolve(this.#workspaceRoot, p));
        const result: Record<string, string> = {};

        const isExcluded = (filePath: string): boolean => absoluteNegations.some((neg) => filePath.startsWith(`${neg}/`) || filePath === neg);

        try {
            if (this.#native) {
                const fileHashes = this.#native.hashFilesInDirectory(absoluteBase, this.#workspaceRoot);
                const incremental = this.#incrementalHasher;

                // Populate the persistent snapshot with the native batch
                // so subsequent runs can reuse these hashes via the
                // incremental fast-path in `#hashFile`. Stat in parallel
                // — snapshot writes are ordered by completion and cheap
                // enough that a sequential loop would dominate for large
                // workspaces.
                const recordPromises: Promise<void>[] = [];

                for (const { hash, path } of fileHashes) {
                    const absPath = resolve(this.#workspaceRoot, path);

                    if (isExcluded(absPath)) {
                        continue;
                    }

                    result[path] = hash;
                    this.#fileHashCache.set(absPath, hash);

                    if (incremental) {
                        recordPromises.push(
                            stat(absPath)
                                .then((s) => {
                                    if (s.isFile()) {
                                        incremental.recordSnapshot(absPath, hash, s.mtimeMs, s.size);
                                    }

                                    return undefined;
                                })
                                .catch(() => {
                                    // Best-effort — missing or unreadable
                                    // file just means the snapshot misses
                                    // next run. Not a correctness issue.
                                }),
                        );
                    }
                }

                if (recordPromises.length > 0) {
                    await Promise.all(recordPromises);
                }

                return result;
            }

            const files = await collectFiles(absoluteBase, IGNORED_DIRS);

            const hashPromises = files.map(async (filePath) => {
                if (isExcluded(filePath)) {
                    return;
                }

                const hash = await this.#hashFile(filePath);

                if (hash) {
                    result[relative(this.#workspaceRoot, filePath)] = hash;
                }
            });

            await Promise.all(hashPromises);
        } catch {
            // Directory doesn't exist or can't be read
        }

        return result;
    }

    async #hashFile(filePath: string): Promise<string | undefined> {
        const cached = this.#fileHashCache.get(filePath);

        if (cached) {
            return cached;
        }

        // Two-layer cache:
        //   1. `#fileHashCache` — per-run, in-memory; checked above.
        //   2. `#incrementalHasher` — cross-run, persisted, mtime+size
        //      indexed; consulted when the in-memory miss hits.
        // The incremental layer skips reading the file content when
        // its mtime and size match the snapshot. Falls back to a full
        // read whenever the snapshot is cold or stale.
        if (this.#incrementalHasher) {
            try {
                const fileStat = await stat(filePath);

                if (fileStat.isFile()) {
                    const snapshotHit = this.#incrementalHasher.getSnapshotHash(filePath, fileStat.mtimeMs, fileStat.size);

                    if (snapshotHit) {
                        this.#fileHashCache.set(filePath, snapshotHit);

                        return snapshotHit;
                    }

                    const content = await readFile(filePath);
                    const hash = xxh3Hash(content);

                    this.#incrementalHasher.recordSnapshot(filePath, hash, fileStat.mtimeMs, fileStat.size);
                    this.#fileHashCache.set(filePath, hash);

                    return hash;
                }
            } catch {
                // stat failed — fall through to the legacy readFile
                // path so behaviour matches the non-incremental mode.
            }
        }

        try {
            const content = await readFile(filePath);
            const hash = xxh3Hash(content);

            this.#fileHashCache.set(filePath, hash);

            return hash;
        } catch {
            return undefined;
        }
    }

    async #hashExternalDependency(depName: string): Promise<string> {
        try {
            const packageJsonPath = join(this.#workspaceRoot, "node_modules", depName, "package.json");
            const packageJsonContent = await readFile(packageJsonPath, "utf8");
            const packageJson = JSON.parse(packageJsonContent) as { version?: string };

            return hashStrings(depName, packageJson.version ?? "unknown");
        } catch {
            return hashStrings(depName, "not-installed");
        }
    }

    /**
     * Computes a combined hash of all global inputs and global env vars.
     * Cached after first computation.
     */
    async #computeGlobalHash(): Promise<string | undefined> {
        if (this.#globalHash !== undefined) {
            return this.#globalHash;
        }

        const hash = createXxh3Hasher();
        let hasContent = false;

        // Hash global input files (parallelized)
        const globalFileHashes = await Promise.all(
            this.#globalInputs
                .filter((input) => !(this.#smartLockfileHashing && LOCKFILE_NAMES.has(input)))
                .map(async (globalInput) => {
                    const fileHash = await this.#hashFile(join(this.#workspaceRoot, globalInput));

                    return fileHash ? { hash: fileHash, name: globalInput } : undefined;
                }),
        );

        for (const entry of globalFileHashes) {
            if (entry) {
                hash.update(entry.name);
                hash.update(entry.hash);
                hasContent = true;
            }
        }

        for (const envName of this.#globalEnv) {
            hash.update(`globalEnv:${envName}=${process.env[envName] ?? ""}`);
            hasContent = true;
        }

        this.#globalHash = hasContent ? hash.digest() : "";

        return this.#globalHash || undefined;
    }

    public clearCache(): void {
        this.#fileHashCache.clear();
        this.#globalHash = undefined;
        this.#lockfileHasher?.clearCache();
    }

    /**
     * Reads `filePath` fresh and returns its content hash, bypassing the
     * in-memory cache used during the initial `hashTask` pass.
     *
     * Used to detect tasks that modify their own tracked inputs: compare
     * a pre-execution hash (from `task.hashDetails.nodes`) against the
     * post-execution result of this method.
     * @param filePath Absolute path to the file.
     * @returns The fresh xxh3 hash, or `undefined` if the file cannot be read.
     */
    // eslint-disable-next-line class-methods-use-this
    public async rehashFile(filePath: string): Promise<string | undefined> {
        try {
            const content = await readFile(filePath);

            return xxh3Hash(content);
        } catch {
            return undefined;
        }
    }
}

/**
 * Computes the final hash for a task from its hash details.
 * Uses native Rust xxh3-128 when available, otherwise pure TS xxh3-ts.
 * Both produce identical xxh3-128 hashes, ensuring cache compatibility
 * regardless of whether the native addon is loaded.
 */
const computeTaskHash = (hashDetails: TaskHashDetails): string => {
    const native = getNativeBindings();

    if (native) {
        const nodes = Object.keys(hashDetails.nodes)
            .toSorted()
            .map((key) => [key, hashDetails.nodes[key] as string]);

        const implicitDeps = hashDetails.implicitDeps
            ? Object.keys(hashDetails.implicitDeps)
                .toSorted()
                .map((key) => [key, (hashDetails.implicitDeps as Record<string, string>)[key] as string])
            : undefined;

        const runtime = hashDetails.runtime
            ? Object.keys(hashDetails.runtime)
                .toSorted()
                .map((key) => [key, (hashDetails.runtime as Record<string, string>)[key] as string])
            : undefined;

        return native.computeTaskHash({
            command: hashDetails.command,
            implicit_deps: implicitDeps,
            nodes,
            runtime,
        });
    }

    const hash = createXxh3Hasher();

    hash.update(hashDetails.command);
    hashSortedEntries(hash, hashDetails.nodes);

    if (hashDetails.implicitDeps) {
        hashSortedEntries(hash, hashDetails.implicitDeps);
    }

    if (hashDetails.runtime) {
        hashSortedEntries(hash, hashDetails.runtime);
    }

    return hash.digest();
};

export { computeTaskHash, InProcessTaskHasher };
export type { TaskHasher, TaskHasherOptions };
