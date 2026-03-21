import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
import { collectFiles, hashStrings, sortObjectKeys } from "./utils";

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

const LOCKFILE_NAMES = new Set([
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
]);

// Cache native bindings at module level for computeTaskHash
let _cachedNative: ReturnType<typeof loadNativeBindings> | undefined;

const getNativeBindings = () => {
    if (_cachedNative === undefined) {
        _cachedNative = loadNativeBindings();
    }

    return _cachedNative;
};

/**
 * Hashes sorted entries of a Record into a Hash object.
 */
const hashSortedEntries = (hash: ReturnType<typeof createHash>, record: Record<string, string>, prefix?: string): void => {
    for (const key of Object.keys(record).sort()) {
        if (prefix) {
            hash.update(`${prefix}${key}`);
        } else {
            hash.update(key);
        }

        hash.update(record[key] as string);
    }
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
        this.#native = getNativeBindings();
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

        const globalHash = await this.#computeGlobalHash();

        if (globalHash) {
            implicitDeps["__global__"] = globalHash;
        }

        const inputs = this.#resolveInputs(task);

        for (const input of inputs) {
            if (isFileSetInput(input)) {
                const fileHashes = await this.#hashFileSet(task, input.fileset);

                for (const [filePath, hash] of Object.entries(fileHashes)) {
                    nodes[filePath] = hash;
                }
            } else if (isRuntimeInput(input)) {
                runtime[input.runtime] = this.#hashRuntime(input.runtime);
            } else if (isEnvironmentInput(input)) {
                runtime[`env:${input.env}`] = hashStrings(input.env, process.env[input.env] ?? "");
            } else if (isExternalDependencyInput(input)) {
                const depHashes = await Promise.all(
                    input.externalDependencies.map(async (dep) => [dep, await this.#hashExternalDependency(dep)] as const),
                );

                for (const [dep, hash] of depHashes) {
                    implicitDeps[dep] = hash;
                }
            }
        }

        for (const envVar of this.#envVars) {
            runtime[`env:${envVar}`] = hashStrings(envVar, process.env[envVar] ?? "");
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
                const frameworkEnvVars = await getFrameworkEnvVars(packageJsonPath);

                for (const envName of Object.keys(frameworkEnvVars)) {
                    runtime[`framework-env:${envName}`] = hashStrings(envName, process.env[envName] ?? "");
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

    #hashCommand(task: Task): string {
        const overridesJson = JSON.stringify(sortObjectKeys(task.overrides));

        if (this.#native) {
            return this.#native.hashCommand(
                task.target.project,
                task.target.target,
                task.target.configuration ?? null,
                overridesJson,
            );
        }

        const hash = createHash("sha256");

        hash.update(task.target.project);
        hash.update(task.target.target);

        if (task.target.configuration) {
            hash.update(task.target.configuration);
        }

        hash.update(overridesJson);

        return hash.digest("hex");
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

    #expandInputs(
        inputs: (string | InputDefinition)[],
        projectName: string,
    ): InputDefinition[] {
        const result: InputDefinition[] = [];
        const seen = new Set<string>();

        for (const input of inputs) {
            if (typeof input === "string") {
                if (input.startsWith("{") || input.startsWith("!{")) {
                    result.push({ fileset: input });
                } else if (input.startsWith("^")) {
                    continue;
                } else if (this.#namedInputs[input] && !seen.has(input)) {
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

        const resolvedPattern = pattern
            .replace("{projectRoot}", projectRoot)
            .replace("{workspaceRoot}", ".");

        const isNegation = resolvedPattern.startsWith("!");

        if (isNegation) {
            return {};
        }

        const absoluteBase = resolve(this.#workspaceRoot, resolvedPattern.replace(/\/\*\*\/\*$/, "").replace(/\/\*$/, ""));
        const result: Record<string, string> = {};

        try {
            if (this.#native) {
                const fileHashes = this.#native.hashFilesInDirectory(
                    absoluteBase,
                    this.#workspaceRoot,
                );

                for (const { path, hash } of fileHashes) {
                    result[path] = hash;
                    this.#fileHashCache.set(resolve(this.#workspaceRoot, path), hash);
                }

                return result;
            }

            const files = await collectFiles(absoluteBase, IGNORED_DIRS);

            const hashPromises = files.map(async (filePath) => {
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

        try {
            const content = await readFile(filePath);
            const hash = createHash("sha256").update(content).digest("hex");

            this.#fileHashCache.set(filePath, hash);

            return hash;
        } catch {
            return undefined;
        }
    }

    #hashRuntime(runtime: string): string {
        if (runtime === "node -v" || runtime === "node --version") {
            return hashStrings(runtime, process.version);
        }

        return hashStrings(runtime, `runtime:${runtime}`);
    }

    async #hashExternalDependency(depName: string): Promise<string> {
        try {
            const packageJsonPath = join(this.#workspaceRoot, "node_modules", depName, "package.json");
            const packageJsonContent = await readFile(packageJsonPath, "utf-8");
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
    async #computeGlobalHash(): Promise<string | null> {
        if (this.#globalHash !== null) {
            return this.#globalHash;
        }

        const hash = createHash("sha256");
        let hasContent = false;

        // Hash global input files (parallelized)
        const globalFileHashes = await Promise.all(
            this.#globalInputs
                .filter((input) => !(this.#smartLockfileHashing && LOCKFILE_NAMES.has(input)))
                .map(async (globalInput) => {
                    const fileHash = await this.#hashFile(join(this.#workspaceRoot, globalInput));

                    return fileHash ? { name: globalInput, hash: fileHash } : null;
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

        this.#globalHash = hasContent ? hash.digest("hex") : "";

        return this.#globalHash || null;
    }

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
    const native = getNativeBindings();

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
    hashSortedEntries(hash, hashDetails.nodes);

    if (hashDetails.implicitDeps) {
        hashSortedEntries(hash, hashDetails.implicitDeps);
    }

    if (hashDetails.runtime) {
        hashSortedEntries(hash, hashDetails.runtime);
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
