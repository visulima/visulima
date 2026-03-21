import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { getFrameworkEnvVariables } from "./framework-inference";
import { LockfileHasher } from "./lockfile-hasher";
import { loadNativeBindings } from "./native-binding";
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
}

/**
 * Options for creating an InProcessTaskHasher.
 */
interface TaskHasherOptions {
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
const hashSortedEntries = (hash: ReturnType<typeof createHash>, record: Record<string, string>, prefix?: string): void => {
    for (const key of Object.keys(record).toSorted()) {
        if (prefix) {
            hash.update(`${prefix}${key}\0`);
        } else {
            hash.update(`${key}\0`);
        }

        hash.update(record[key] as string);
    }
};

const hashRuntimeValue = (runtime: string): string => {
    if (runtime === "node -v" || runtime === "node --version") {
        return hashStrings(runtime, process.version);
    }

    return hashStrings(runtime, `runtime:${runtime}`);
};

// Type guards
const isFileSetInput = (input: InputDefinition): input is FileSetInput => "fileset" in input;

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
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
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
        const negationPatterns: string[] = [];

        // First pass: collect negation patterns
        for (const input of inputs) {
            if (isFileSetInput(input)) {
                const project = this.#projects[task.target.project];
                const projectRoot = project?.root ?? "";
                const resolved = input.fileset.replace("{projectRoot}", projectRoot).replace("{workspaceRoot}", ".");

                if (resolved.startsWith("!")) {
                    negationPatterns.push(
                        resolved
                            .slice(1)
                            .replace(/\/\*\*\/\*$/, "")
                            .replace(/\/\*$/, ""),
                    );
                }
            }
        }

        for (const input of inputs) {
            if (isFileSetInput(input)) {
                // eslint-disable-next-line no-await-in-loop -- filesets must be processed sequentially to accumulate into shared nodes/runtime maps
                const fileHashes = await this.#hashFileSet(task, input.fileset, negationPatterns);

                for (const [filePath, hash] of Object.entries(fileHashes)) {
                    nodes[filePath] = hash;
                }
            } else if (isRuntimeInput(input)) {
                runtime[input.runtime] = hashRuntimeValue(input.runtime);
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

    #hashCommand(task: Task): string {
        const overridesJson = JSON.stringify(sortObjectKeys(task.overrides));

        if (this.#native) {
            return this.#native.hashCommand(task.target.project, task.target.target, task.target.configuration ?? undefined, overridesJson);
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

    #expandInputs(inputs: (string | InputDefinition)[], projectName: string): InputDefinition[] {
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
                    result.push(...this.#expandInputs(this.#namedInputs[input] as (string | InputDefinition)[], projectName));
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

                for (const { hash, path } of fileHashes) {
                    const absPath = resolve(this.#workspaceRoot, path);

                    if (!isExcluded(absPath)) {
                        result[path] = hash;
                        this.#fileHashCache.set(absPath, hash);
                    }
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

        try {
            const content = await readFile(filePath);
            const hash = createHash("sha256").update(content).digest("hex");

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

        const hash = createHash("sha256");
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

        this.#globalHash = hasContent ? hash.digest("hex") : "";

        return this.#globalHash || undefined;
    }

    public clearCache(): void {
        this.#fileHashCache.clear();
        this.#globalHash = undefined;
        this.#lockfileHasher?.clearCache();
    }
}

/**
 * Computes the final hash for a task from its hash details.
 * Uses native Rust implementation when available.
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

export { computeTaskHash, InProcessTaskHasher };
export type { TaskHasher, TaskHasherOptions };
