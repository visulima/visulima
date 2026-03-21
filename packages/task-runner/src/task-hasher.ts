import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type {
    EnvironmentInput,
    ExternalDependencyInput,
    FileSetInput,
    InputDefinition,
    NamedInputs,
    ProjectConfiguration,
    RuntimeInput,
    Task,
    TaskHashDetails,
    TargetConfiguration,
} from "./types";
import { loadNativeBindings } from "./native-binding";
import { LockfileHasher } from "./lockfile-hasher";
import { getFrameworkEnvVars } from "./framework-inference";

/**
 * Interface for task hashers.
 */
export interface TaskHasher {
    hashTask(task: Task): Promise<TaskHashDetails>;
}

/**
 * Options for creating an InProcessTaskHasher.
 */
export interface TaskHasherOptions {
    /** The workspace root directory */
    workspaceRoot: string;
    /** Project configurations keyed by project name */
    projects: Record<string, ProjectConfiguration>;
    /** Named input definitions */
    namedInputs?: NamedInputs;
    /** Target default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** Additional environment variables to include in hash */
    envVars?: string[];
    /**
     * Global input files that invalidate all task hashes when changed.
     * These are workspace-root-relative paths (e.g., "pnpm-lock.yaml").
     */
    globalInputs?: string[];
    /**
     * Global environment variables that invalidate all task hashes.
     */
    globalEnv?: string[];
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
    /**
     * Enable framework environment variable inference.
     * When true, auto-detects frameworks and includes their public
     * env var prefixes in the task hash.
     * @default false
     */
    frameworkInference?: boolean;
}

const DEFAULT_GLOBAL_INPUTS = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "tsconfig.base.json",
    "tsconfig.json",
    ".env",
];

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

/**
 * Recursively collects all files in a directory, ignoring common non-source directories.
 */
const collectFiles = async (dir: string): Promise<string[]> => {
    const results: string[] = [];

    try {
        const dirStat = await stat(dir);

        if (dirStat.isFile()) {
            return [dir];
        }

        const entries = await readdir(dir, { withFileTypes: true });

        const promises = entries.map(async (entry) => {
            if (IGNORED_DIRS.has(entry.name)) {
                return [];
            }

            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                return collectFiles(fullPath);
            }

            if (entry.isFile()) {
                return [fullPath];
            }

            return [];
        });

        const nested = await Promise.all(promises);

        for (const files of nested) {
            results.push(...files);
        }
    } catch {
        // Directory doesn't exist or can't be read
    }

    return results;
};

/**
 * Computes hashes for tasks based on their inputs.
 * Used to determine if a cached result can be reused.
 */
export class InProcessTaskHasher implements TaskHasher {
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
    readonly #lockfileHasher: LockfileHasher | null;
    readonly #frameworkInference: boolean;
    #globalHash: string | null = null;

    constructor(options: TaskHasherOptions) {
        this.#workspaceRoot = options.workspaceRoot;
        this.#projects = options.projects;
        this.#namedInputs = options.namedInputs ?? {};
        this.#targetDefaults = options.targetDefaults ?? {};
        this.#envVars = options.envVars ?? [];
        this.#globalInputs = options.globalInputs ?? DEFAULT_GLOBAL_INPUTS;
        this.#globalEnv = options.globalEnv ?? [];
        this.#native = loadNativeBindings();
        this.#smartLockfileHashing = options.smartLockfileHashing ?? false;
        this.#lockfileHasher = this.#smartLockfileHashing
            ? new LockfileHasher(options.workspaceRoot)
            : null;
        this.#frameworkInference = options.frameworkInference ?? false;
    }

    async hashTask(task: Task): Promise<TaskHashDetails> {
        const commandHash = this.#hashCommand(task);
        const nodes: Record<string, string> = {};
        const implicitDeps: Record<string, string> = {};
        const runtime: Record<string, string> = {};

        // Include global inputs hash (lock files, tsconfig, .env)
        const globalHash = await this.#computeGlobalHash();

        if (globalHash) {
            implicitDeps["__global__"] = globalHash;
        }

        // Resolve inputs for the task
        const inputs = this.#resolveInputs(task);

        // Hash each input
        for (const input of inputs) {
            if (isFileSetInput(input)) {
                const fileHashes = await this.#hashFileSet(task, input.fileset);

                for (const [filePath, hash] of Object.entries(fileHashes)) {
                    nodes[filePath] = hash;
                }
            } else if (isRuntimeInput(input)) {
                const hash = this.#hashRuntime(input.runtime);

                runtime[input.runtime] = hash;
            } else if (isEnvironmentInput(input)) {
                const hash = this.#hashEnvironment(input.env);

                runtime[`env:${input.env}`] = hash;
            } else if (isExternalDependencyInput(input)) {
                for (const dep of input.externalDependencies) {
                    const hash = await this.#hashExternalDependency(dep);

                    implicitDeps[dep] = hash;
                }
            }
        }

        // Include configured env vars
        for (const envVar of this.#envVars) {
            const hash = this.#hashEnvironment(envVar);

            runtime[`env:${envVar}`] = hash;
        }

        // Smart lockfile hashing: hash only the resolved deps relevant to this project
        if (this.#lockfileHasher) {
            const project = this.#projects[task.target.project];

            if (project) {
                const packageJsonPath = join(project.root, "package.json");
                const lockfileHash = await this.#lockfileHasher.hashForPackage(packageJsonPath);

                if (lockfileHash) {
                    implicitDeps["__lockfile__"] = lockfileHash.hash;
                }
            }
        }

        // Framework inference: auto-detect framework env vars and include in hash
        if (this.#frameworkInference) {
            const project = this.#projects[task.target.project];

            if (project) {
                const packageJsonPath = resolve(this.#workspaceRoot, project.root, "package.json");
                const frameworkEnvVars = await getFrameworkEnvVars(packageJsonPath);

                for (const [envName, value] of Object.entries(frameworkEnvVars)) {
                    const hash = this.#hashEnvironment(envName);

                    runtime[`framework-env:${envName}`] = hash;
                }
            }
        }

        return {
            command: commandHash,
            nodes,
            implicitDeps: Object.keys(implicitDeps).length > 0 ? implicitDeps : undefined,
            runtime: Object.keys(runtime).length > 0 ? runtime : undefined,
        };
    }

    /**
     * Computes a hash of the task command.
     * Uses native Rust implementation when available for better performance.
     */
    #hashCommand(task: Task): string {
        if (this.#native) {
            const sortedOverrides = Object.keys(task.overrides)
                .sort()
                .reduce<Record<string, unknown>>((accumulator, key) => {
                    accumulator[key] = task.overrides[key];
                    return accumulator;
                }, {});

            return this.#native.hashCommand(
                task.target.project,
                task.target.target,
                task.target.configuration ?? null,
                JSON.stringify(sortedOverrides),
            );
        }

        const hash = createHash("sha256");

        hash.update(task.target.project);
        hash.update(task.target.target);

        if (task.target.configuration) {
            hash.update(task.target.configuration);
        }

        const sortedOverrides = Object.keys(task.overrides)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = task.overrides[key];
                return accumulator;
            }, {});

        hash.update(JSON.stringify(sortedOverrides));

        return hash.digest("hex");
    }

    /**
     * Resolves the inputs for a task, expanding named inputs.
     */
    #resolveInputs(task: Task): InputDefinition[] {
        const project = this.#projects[task.target.project];
        const targetConfig = project?.targets?.[task.target.target];
        const defaultConfig = this.#targetDefaults[task.target.target];

        const rawInputs = targetConfig?.inputs ?? defaultConfig?.inputs;

        if (!rawInputs) {
            // Default: hash all files in the project
            return [{ fileset: "{projectRoot}/**/*" }];
        }

        return this.#expandInputs(rawInputs, task.target.project);
    }

    /**
     * Expands input definitions, resolving named input references.
     */
    #expandInputs(
        inputs: (string | InputDefinition)[],
        projectName: string,
    ): InputDefinition[] {
        const result: InputDefinition[] = [];
        const seen = new Set<string>();

        for (const input of inputs) {
            if (typeof input === "string") {
                // Check if it's a named input reference
                if (input.startsWith("{") || input.startsWith("!{")) {
                    result.push({ fileset: input });
                } else if (input.startsWith("^")) {
                    // Dependency input - not expanded here, handled at graph level
                    continue;
                } else if (this.#namedInputs[input] && !seen.has(input)) {
                    // Named input reference
                    seen.add(input);
                    result.push(
                        ...this.#expandInputs(this.#namedInputs[input] as (string | InputDefinition)[], projectName),
                    );
                } else {
                    result.push({ fileset: input });
                }
            } else {
                result.push(input);
            }
        }

        return result;
    }

    /**
     * Hashes all files matching a fileset pattern.
     * Uses native Rust parallel hashing (via rayon) when available.
     */
    async #hashFileSet(
        task: Task,
        pattern: string,
    ): Promise<Record<string, string>> {
        const project = this.#projects[task.target.project];
        const projectRoot = project?.root ?? "";

        // Resolve pattern variables
        const resolvedPattern = pattern
            .replace("{projectRoot}", projectRoot)
            .replace("{workspaceRoot}", ".");

        const isNegation = resolvedPattern.startsWith("!");
        const actualPattern = isNegation ? resolvedPattern.slice(1) : resolvedPattern;

        if (isNegation) {
            // Negation patterns are handled by glob
            return {};
        }

        const absoluteBase = resolve(this.#workspaceRoot, actualPattern.replace(/\/\*\*\/\*$/, "").replace(/\/\*$/, ""));
        const result: Record<string, string> = {};

        try {
            // Use native parallel hashing when available
            if (this.#native) {
                const fileHashes = this.#native.hashFilesInDirectory(
                    absoluteBase,
                    this.#workspaceRoot,
                );

                for (const { path, hash } of fileHashes) {
                    result[path] = hash;
                    // Also populate the cache for potential reuse
                    this.#fileHashCache.set(resolve(this.#workspaceRoot, path), hash);
                }

                return result;
            }

            // Fallback: TypeScript-based sequential hashing
            const files = await collectFiles(absoluteBase);

            const hashPromises = files.map(async (filePath) => {
                const hash = await this.#hashFile(filePath);

                if (hash) {
                    const relativePath = relative(this.#workspaceRoot, filePath);

                    result[relativePath] = hash;
                }
            });

            await Promise.all(hashPromises);
        } catch {
            // Directory doesn't exist or can't be read
        }

        return result;
    }

    /**
     * Hashes a single file.
     */
    async #hashFile(filePath: string): Promise<string | undefined> {
        const cached = this.#fileHashCache.get(filePath);

        if (cached) {
            return cached;
        }

        try {
            const content = await readFile(filePath);
            const hash = createHash("sha256").update(content).digest("hex");

            this.#fileHashCache.set(filePath, hash);

            return hash;
        } catch {
            return undefined;
        }
    }

    /**
     * Hashes a runtime input (e.g., node version).
     */
    #hashRuntime(runtime: string): string {
        const hash = createHash("sha256");

        hash.update(runtime);

        // For common runtimes, use known values
        if (runtime === "node -v" || runtime === "node --version") {
            hash.update(process.version);
        } else {
            // Use the runtime string itself as a placeholder
            hash.update(`runtime:${runtime}`);
        }

        return hash.digest("hex");
    }

    /**
     * Hashes an environment variable.
     */
    #hashEnvironment(envName: string): string {
        const hash = createHash("sha256");
        const value = process.env[envName] ?? "";

        hash.update(envName);
        hash.update(value);

        return hash.digest("hex");
    }

    /**
     * Hashes an external dependency by reading its package.json version.
     */
    async #hashExternalDependency(depName: string): Promise<string> {
        const hash = createHash("sha256");

        hash.update(depName);

        try {
            const packageJsonPath = join(
                this.#workspaceRoot,
                "node_modules",
                depName,
                "package.json",
            );
            const packageJsonContent = await readFile(packageJsonPath, "utf-8");
            const packageJson = JSON.parse(packageJsonContent) as { version?: string };

            hash.update(packageJson.version ?? "unknown");
        } catch {
            hash.update("not-installed");
        }

        return hash.digest("hex");
    }

    /**
     * Computes a combined hash of all global inputs (lock files, tsconfig, .env)
     * and global env vars. Cached after first computation.
     */
    async #computeGlobalHash(): Promise<string | null> {
        if (this.#globalHash !== null) {
            return this.#globalHash;
        }

        const hash = createHash("sha256");
        let hasContent = false;

        // Lockfile patterns to skip when smart lockfile hashing is enabled
        const lockfileNames = new Set([
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
        ]);

        // Hash global input files
        for (const globalInput of this.#globalInputs) {
            // Skip lockfiles in global hash when smart lockfile hashing is active
            if (this.#smartLockfileHashing && lockfileNames.has(globalInput)) {
                continue;
            }

            const filePath = join(this.#workspaceRoot, globalInput);
            const fileHash = await this.#hashFile(filePath);

            if (fileHash) {
                hash.update(globalInput);
                hash.update(fileHash);
                hasContent = true;
            }
        }

        // Hash global env vars
        for (const envName of this.#globalEnv) {
            const value = process.env[envName] ?? "";

            hash.update(`globalEnv:${envName}=${value}`);
            hasContent = true;
        }

        this.#globalHash = hasContent ? hash.digest("hex") : "";

        return this.#globalHash || null;
    }

    /**
     * Clears the file hash cache.
     */
    clearCache(): void {
        this.#fileHashCache.clear();
        this.#globalHash = null;
        this.#lockfileHasher?.clearCache();
    }
}

/**
 * Computes the final hash for a task from its hash details.
 * Uses native Rust implementation when available.
 */
export const computeTaskHash = (hashDetails: TaskHashDetails): string => {
    const native = loadNativeBindings();

    if (native) {
        const nodes = Object.keys(hashDetails.nodes)
            .sort()
            .map((key) => [key, hashDetails.nodes[key] as string]);

        const implicitDeps = hashDetails.implicitDeps
            ? Object.keys(hashDetails.implicitDeps)
                  .sort()
                  .map((key) => [key, hashDetails.implicitDeps![key] as string])
            : undefined;

        const runtime = hashDetails.runtime
            ? Object.keys(hashDetails.runtime)
                  .sort()
                  .map((key) => [key, hashDetails.runtime![key] as string])
            : undefined;

        return native.computeTaskHash({
            command: hashDetails.command,
            nodes,
            implicit_deps: implicitDeps,
            runtime,
        });
    }

    const hash = createHash("sha256");

    hash.update(hashDetails.command);

    // Sort and hash nodes
    for (const key of Object.keys(hashDetails.nodes).sort()) {
        hash.update(key);
        hash.update(hashDetails.nodes[key] as string);
    }

    // Sort and hash implicit deps
    if (hashDetails.implicitDeps) {
        for (const key of Object.keys(hashDetails.implicitDeps).sort()) {
            hash.update(key);
            hash.update(hashDetails.implicitDeps[key] as string);
        }
    }

    // Sort and hash runtime
    if (hashDetails.runtime) {
        for (const key of Object.keys(hashDetails.runtime).sort()) {
            hash.update(key);
            hash.update(hashDetails.runtime[key] as string);
        }
    }

    return hash.digest("hex");
};

// Type guards
const isFileSetInput = (input: InputDefinition): input is FileSetInput =>
    "fileset" in input;

const isRuntimeInput = (input: InputDefinition): input is RuntimeInput =>
    "runtime" in input;

const isEnvironmentInput = (input: InputDefinition): input is EnvironmentInput =>
    "env" in input;

const isExternalDependencyInput = (input: InputDefinition): input is ExternalDependencyInput =>
    "externalDependencies" in input;
