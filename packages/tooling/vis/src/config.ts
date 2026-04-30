import { createHash } from "node:crypto";
import { copyFileSync, readdirSync, readFileSync as fsReadFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

import { findCacheDirSync } from "@visulima/find-cache-dir";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeJsonSync } from "@visulima/fs";
import { dirname, isAbsolute, join } from "@visulima/path";
import { createJiti } from "jiti";

import { VisConfigCycleError, VisConfigLoadError, VisConfigNotFoundError } from "./errors";
import type { VisPlugin } from "./hooks";
import { mergeTargetWithInherit } from "./target-merge";
import type { VisConfig, VisTaskConfig } from "./workspace";

/** Supported config file names, checked in priority order. */
const CONFIG_FILES: string[] = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

/** Set form of `CONFIG_FILES` — kept in sync, used for O(1) membership. */
const CONFIG_FILE_SET = new Set(CONFIG_FILES);

/** Per-package overlay file names, checked in priority order. */
const TASK_CONFIG_FILES: string[] = ["vis.task.ts", "vis.task.mts", "vis.task.cts", "vis.task.js", "vis.task.mjs", "vis.task.cjs"];

const TASK_CONFIG_FILE_SET = new Set(TASK_CONFIG_FILES);

/**
 * Secure-by-default security settings based on npm supply chain best practices.
 *
 * These defaults are applied automatically when using `defineConfig()` or `loadVisConfig()`.
 * Users can override any value — their settings always take precedence.
 * @see https://github.com/lirantal/awesome-npm-security-best-practices
 */
const SECURITY_DEFAULTS: Required<
    Pick<NonNullable<VisConfig["security"]>, "blockExoticSubdeps" | "strictDepBuilds" | "trustPolicy" | "trustPolicyIgnoreAfter">
> = {
    /** Block transitive dependencies from using git repos or tarball URLs. */
    blockExoticSubdeps: true,
    /** Make unapproved build scripts a hard error instead of a warning. */
    strictDepBuilds: true,
    /** Fail if a package's trust level has decreased compared to prior releases. */
    trustPolicy: "no-downgrade" as const,
    /** Skip trust policy check for packages published more than 30 days ago. */
    trustPolicyIgnoreAfter: 43_200,
};

/**
 * Deep-merge user security settings with secure defaults.
 * User-provided values always win.
 */
const mergeSecurityDefaults = (security: VisConfig["security"]): VisConfig["security"] => {
    return {
        ...SECURITY_DEFAULTS,
        ...security,
    };
};

/**
 * Apply secure defaults to a raw config object.
 * Merges `SECURITY_DEFAULTS` into `config.security`, preserving all user overrides.
 */
const applyDefaults = (config: VisConfig): VisConfig => {
    return {
        ...config,
        security: mergeSecurityDefaults(config.security),
        update: {
            security: true,
            target: "minor" as const,
            ...config.update,
        },
    };
};

/**
 * Find the vis config file in a directory.
 *
 * Reads the directory listing once and intersects it with the known
 * config filenames rather than `stat`-ing each candidate — one syscall
 * instead of up to six. Priority order is preserved via
 * `CONFIG_FILES` so `.ts` still wins over `.mjs` when both exist.
 * @param directory The directory to search in.
 * @returns The absolute path to the config file, or `undefined` if not found.
 */
const findVisConfigFile = (directory: string): string | undefined => {
    let entries: string[];

    try {
        entries = readdirSync(directory);
    } catch {
        return undefined;
    }

    const present = new Set(entries.filter((name) => CONFIG_FILE_SET.has(name)));

    for (const file of CONFIG_FILES) {
        if (present.has(file)) {
            return join(directory, file);
        }
    }

    return undefined;
};

/**
 * Find the per-package `vis.task.ts` overlay in a project directory.
 * Same single-readdir lookup pattern as {@link findVisConfigFile}.
 */
const findVisTaskConfigFile = (projectDirectory: string): string | undefined => {
    let entries: string[];

    try {
        entries = readdirSync(projectDirectory);
    } catch {
        return undefined;
    }

    const present = new Set(entries.filter((name) => TASK_CONFIG_FILE_SET.has(name)));

    for (const file of TASK_CONFIG_FILES) {
        if (present.has(file)) {
            return join(projectDirectory, file);
        }
    }

    return undefined;
};

// ── Config cache ────────────────────────────────────────────────────

interface ConfigCache {
    config: VisConfig;
    hash: string;
}

const hashFileContents = (filePath: string): string => createHash("sha256").update(fsReadFileSync(filePath)).digest("hex");

/**
 * Composite hash for a chain of config files. Sorting by absolute path
 * makes the result independent of resolution order — diamond imports
 * (A and B both extend C) collapse to one entry.
 */
const hashConfigChain = (paths: readonly string[]): string => {
    const hasher = createHash("sha256");
    const sorted = [...paths].sort();

    for (const path of sorted) {
        hasher.update(path);
        hasher.update(":");
        hasher.update(hashFileContents(path));
        hasher.update("\n");
    }

    return hasher.digest("hex");
};

const getConfigCachePath = (workspaceRoot: string): string | undefined => {
    // First try: use node_modules/.cache/vis directly if node_modules exists
    // in the workspace root. This avoids findCacheDirSync traversing to a
    // parent project's node_modules when the workspace root lacks package.json.
    const nodeModulesDir = join(workspaceRoot, "node_modules");

    if (isAccessibleSync(nodeModulesDir)) {
        const directCacheDir = join(nodeModulesDir, ".cache", "vis");

        ensureDirSync(directCacheDir);

        return join(directCacheDir, "vis-config-cache.json");
    }

    // Fallback: standard cache dir resolution
    const cacheDir = findCacheDirSync("vis", { create: true, cwd: workspaceRoot });

    return cacheDir ? join(cacheDir, "vis-config-cache.json") : undefined;
};

const readConfigCache = (cachePath: string, hash: string): VisConfig | undefined => {
    if (!isAccessibleSync(cachePath)) {
        return undefined;
    }

    try {
        const cache = readJsonSync(cachePath) as unknown as ConfigCache;

        if (cache.hash === hash) {
            return cache.config;
        }
    } catch {
        // Corrupt cache — ignore
    }

    return undefined;
};

const writeConfigCache = (cachePath: string, hash: string, config: VisConfig): void => {
    try {
        ensureDirSync(dirname(cachePath));
        writeJsonSync(cachePath, { config, hash } satisfies ConfigCache);
    } catch {
        // Non-critical
    }
};

// ── Extends resolver ────────────────────────────────────────────────

const normalizeExtends = (value: VisConfig["extends"]): string[] => {
    if (value === undefined) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

/**
 * Resolve an `extends` specifier against the file that declared it.
 *
 * - Relative paths (`./` / `../`) → resolved against the parent's directory.
 * - Bare specifiers (`@acme/preset`, `vis-preset-foo`) → npm resolution
 *   from the parent file. The package may export the config file directly
 *   or a `.js`/`.ts` module that default-exports a `VisConfig`.
 * - Absolute paths → rejected; they break across machines and CI.
 */
const resolveExtendsSpecifier = (specifier: string, parentFile: string, chain: readonly string[]): string => {
    if (isAbsolute(specifier)) {
        throw new VisConfigNotFoundError(specifier, [...chain, parentFile], [
            "Absolute paths in `extends` are not supported. Use a relative path or an npm package name.",
        ]);
    }

    const attempted: string[] = [];

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const parentDirectory = dirname(parentFile);
        const resolved = join(parentDirectory, specifier);

        attempted.push(resolved);

        if (isAccessibleSync(resolved)) {
            return resolved;
        }

        throw new VisConfigNotFoundError(specifier, [...chain, parentFile], attempted);
    }

    try {
        const requireFromParent = createRequire(parentFile);

        return requireFromParent.resolve(specifier);
    } catch {
        attempted.push(`require.resolve("${specifier}") from ${parentFile}`);
        throw new VisConfigNotFoundError(specifier, [...chain, parentFile], attempted);
    }
};

// ── Config loader ───────────────────────────────────────────────────

/**
 * Load a single config file via jiti and return its raw export. Wraps
 * any throw in `VisConfigLoadError` so a syntax error surfaces with the
 * source path instead of bubbling up as a workspace.ts failure.
 */
const loadRawConfig = async (jiti: ReturnType<typeof createJiti>, configPath: string, chain: readonly string[]): Promise<VisConfig> => {
    const hash = hashFileContents(configPath);
    const extension = configPath.slice(configPath.lastIndexOf("."));
    // Copy to a unique temp file to bypass jiti's internal module cache
    // (jiti caches by file path and ignores moduleCache: false for ESM).
    const temporaryConfigPath = join(tmpdir(), `vis-config-${hash}${extension}`);

    copyFileSync(configPath, temporaryConfigPath);

    let loaded: unknown;

    try {
        loaded = (await jiti.import(temporaryConfigPath, { default: true, try: true })) ?? {};
    } catch (cause) {
        throw new VisConfigLoadError(configPath, chain, cause);
    } finally {
        try {
            unlinkSync(temporaryConfigPath);
        } catch {
            // Non-critical cleanup
        }
    }

    try {
        return (typeof loaded === "function" ? ((await (loaded as () => VisConfig | Promise<VisConfig>)()) ?? {}) : (loaded as VisConfig)) ?? {};
    } catch (cause) {
        throw new VisConfigLoadError(configPath, chain, cause);
    }
};

/**
 * Merge two `VisConfig` objects — child wins. Most top-level fields are
 * shallow-merged; `targetDefaults` runs through {@link mergeTargetWithInherit}
 * so the `@inherit` sentinel works across the extends chain;
 * `taskDefaults` blocks concatenate (parent first, child last), which
 * preserves the existing "later block wins" precedence.
 */
const mergeVisConfigs = (parent: VisConfig, child: VisConfig): VisConfig => {
    const merged: VisConfig = { ...parent, ...child };

    if (parent.targetDefaults || child.targetDefaults) {
        const names = new Set<string>([...Object.keys(parent.targetDefaults ?? {}), ...Object.keys(child.targetDefaults ?? {})]);
        const out: NonNullable<VisConfig["targetDefaults"]> = {};

        for (const name of names) {
            out[name] = mergeTargetWithInherit(parent.targetDefaults?.[name], child.targetDefaults?.[name]);
        }

        merged.targetDefaults = out;
    }

    if (parent.taskDefaults || child.taskDefaults) {
        merged.taskDefaults = [...(parent.taskDefaults ?? []), ...(child.taskDefaults ?? [])];
    }

    if (parent.fileGroups || child.fileGroups) {
        merged.fileGroups = { ...parent.fileGroups, ...child.fileGroups };
    }

    if (parent.taskGroups || child.taskGroups) {
        merged.taskGroups = { ...parent.taskGroups, ...child.taskGroups };
    }

    if (parent.security || child.security) {
        merged.security = { ...parent.security, ...child.security };
    }

    if (parent.update || child.update) {
        merged.update = { ...parent.update, ...child.update };
    }

    if (parent.taskRunnerOptions || child.taskRunnerOptions) {
        merged.taskRunnerOptions = { ...parent.taskRunnerOptions, ...child.taskRunnerOptions };
    }

    // `extends` is consumed during resolution — never propagated downstream.
    delete merged.extends;

    return merged;
};

/**
 * Recursively load a config file and everything it `extends`. Maintains
 * two pieces of state across the recursion:
 *
 * - `inFlight` — paths currently on the stack. Re-entering one is a cycle.
 * - `loaded` — paths already fully loaded (cached). Re-entering one is a
 *   diamond and short-circuits to the cached raw config.
 *
 * Returns the post-order traversal: extends first, current last. The
 * caller folds this into a single merged `VisConfig`.
 */
const resolveConfigChain = async (
    jiti: ReturnType<typeof createJiti>,
    configPath: string,
    chain: readonly string[],
    inFlight: Set<string>,
    loaded: Map<string, VisConfig>,
    order: string[],
): Promise<void> => {
    if (inFlight.has(configPath)) {
        throw new VisConfigCycleError(configPath, chain);
    }

    if (loaded.has(configPath)) {
        return;
    }

    inFlight.add(configPath);

    try {
        const raw = await loadRawConfig(jiti, configPath, chain);
        const extendsList = normalizeExtends(raw.extends);

        for (const specifier of extendsList) {
            const resolved = resolveExtendsSpecifier(specifier, configPath, chain);

            await resolveConfigChain(jiti, resolved, [...chain, configPath], inFlight, loaded, order);
        }

        loaded.set(configPath, raw);
        order.push(configPath);
    } finally {
        inFlight.delete(configPath);
    }
};

/**
 * Load the vis configuration from a `vis.config.ts` (or `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`) file.
 *
 * Resolves the entire `extends` chain, post-order, and folds it into a
 * single merged config (extends first, root last — child wins). The
 * cache key covers every file in the chain, so editing any extended
 * file invalidates the cache.
 *
 * Falls back to secure defaults if no config file is found.
 * @param workspaceRoot The workspace root directory to search for the config file.
 * @returns The loaded and resolved configuration with secure defaults applied.
 */
const loadVisConfig = async (workspaceRoot: string): Promise<VisConfig> => {
    const rootConfigPath = findVisConfigFile(workspaceRoot);

    if (!rootConfigPath) {
        return applyDefaults({});
    }

    const jiti = createJiti(workspaceRoot, { fsCache: false, moduleCache: false });
    const inFlight = new Set<string>();
    const loaded = new Map<string, VisConfig>();
    const order: string[] = [];

    await resolveConfigChain(jiti, rootConfigPath, [], inFlight, loaded, order);

    const chainHash = hashConfigChain(order);
    const cachePath = getConfigCachePath(workspaceRoot);

    if (cachePath) {
        const cached = readConfigCache(cachePath, chainHash);

        if (cached) {
            return cached;
        }
    }

    let merged: VisConfig = {};

    for (const path of order) {
        merged = mergeVisConfigs(merged, loaded.get(path)!);
    }

    const finalConfig = applyDefaults(merged);

    if (cachePath) {
        writeConfigCache(cachePath, chainHash, finalConfig);
    }

    return finalConfig;
};

// ── Per-package task config loader ──────────────────────────────────

interface VisTaskConfigCache {
    config: VisTaskConfig;
    hash: string;
}

const sanitizeProjectName = (projectName: string): string => projectName.replace(/[^\w.-]+/g, "_");

const getVisTaskCachePath = (workspaceRoot: string, projectName: string): string | undefined => {
    const nodeModulesDir = join(workspaceRoot, "node_modules");
    const safeName = sanitizeProjectName(projectName);

    if (isAccessibleSync(nodeModulesDir)) {
        const directCacheDir = join(nodeModulesDir, ".cache", "vis", "task-configs");

        ensureDirSync(directCacheDir);

        return join(directCacheDir, `${safeName}.json`);
    }

    const cacheDir = findCacheDirSync("vis", { create: true, cwd: workspaceRoot });

    return cacheDir ? join(cacheDir, "task-configs", `${safeName}.json`) : undefined;
};

const readVisTaskCache = (cachePath: string, hash: string): VisTaskConfig | undefined => {
    if (!isAccessibleSync(cachePath)) {
        return undefined;
    }

    try {
        const cache = readJsonSync(cachePath) as unknown as VisTaskConfigCache;

        if (cache.hash === hash) {
            return cache.config;
        }
    } catch {
        // Corrupt cache — ignore
    }

    return undefined;
};

const writeVisTaskCache = (cachePath: string, hash: string, config: VisTaskConfig): void => {
    try {
        ensureDirSync(dirname(cachePath));
        writeJsonSync(cachePath, { config, hash } satisfies VisTaskConfigCache);
    } catch {
        // Non-critical
    }
};

/**
 * Load the per-package `vis.task.ts` overlay for a project, if any.
 *
 * Returns `undefined` when no overlay file exists. Otherwise compiles
 * the file via jiti and caches the result under
 * `node_modules/.cache/vis/task-configs/<project>.json`, keyed by the
 * file's content hash. Editing one project's overlay does not invalidate
 * the root config cache.
 *
 * Errors thrown by the file are wrapped in `VisConfigLoadError` so the
 * source path is reported instead of an opaque workspace.ts failure.
 * @param workspaceRoot Absolute workspace root path (cache scope).
 * @param projectDirectory Absolute path of the project to probe.
 * @param projectName Project identifier — used to scope the cache file.
 */
const loadVisTaskConfig = async (
    workspaceRoot: string,
    projectDirectory: string,
    projectName: string,
): Promise<VisTaskConfig | undefined> => {
    const taskConfigPath = findVisTaskConfigFile(projectDirectory);

    if (!taskConfigPath) {
        return undefined;
    }

    const hash = hashFileContents(taskConfigPath);
    const cachePath = getVisTaskCachePath(workspaceRoot, projectName);

    if (cachePath) {
        const cached = readVisTaskCache(cachePath, hash);

        if (cached) {
            return cached;
        }
    }

    const jiti = createJiti(projectDirectory, { fsCache: false, moduleCache: false });
    const raw = await loadRawConfig(jiti, taskConfigPath, []);
    const taskConfig = raw as unknown as VisTaskConfig;

    if (cachePath) {
        writeVisTaskCache(cachePath, hash, taskConfig);
    }

    return taskConfig;
};

/**
 * Type-safe helper for defining a per-package `vis.task.ts` overlay.
 * Pure identity — exists only so users get type inference and
 * autocomplete from the `VisTaskConfig` shape.
 * @example
 * ```typescript
 * // packages/api/crud/vis.task.ts
 * import { defineTaskConfig } from "@visulima/vis/config";
 *
 * export default defineTaskConfig({
 *     targets: {
 *         build: {
 *             inputs: ["@inherit", "src/proto/**\/*.proto"],
 *             outputs: ["dist/**\/*"],
 *         },
 *     },
 * });
 * ```
 */
const defineTaskConfig = (config: VisTaskConfig): VisTaskConfig => config;

/**
 * Type-safe helper for defining vis configuration.
 * Provides full TypeScript autocomplete when used in `vis.config.ts`.
 *
 * Secure defaults are applied automatically — you only need to specify overrides.
 * To see the active defaults, run `vis check --security-config`.
 * @example
 * ```typescript
 * // vis.config.ts — minimal config, fully secured by defaults
 * import { defineConfig } from "@visulima/vis/config";
 *
 * export default defineConfig({
 *     security: {
 *         allowBuilds: {
 *             esbuild: true,
 *             "@prisma/client": true,
 *         },
 *     },
 * });
 * ```
 * @example
 * ```typescript
 * // vis.config.ts — override a default
 * import { defineConfig } from "@visulima/vis/config";
 *
 * export default defineConfig({
 *     security: {
 *         // Relax cooldown to 24 hours instead of the default 14 days
 *         minimumReleaseAge: 1440,
 *         allowBuilds: { esbuild: true },
 *     },
 * });
 * ```
 */
const defineConfig = (config: VisConfig): VisConfig => applyDefaults(config);

/**
 * Type-safe helper for defining a vis plugin. Pure identity — exists
 * only so plugin authors get inference from the `VisPlugin` contract
 * without needing a `satisfies` annotation.
 */
const definePlugin = (plugin: VisPlugin): VisPlugin => plugin;

export type { VisHooks, VisPlugin } from "./hooks";
// Ship the OTel plugin from the `/config` subpath so users can
// `import { otelPlugin } from "@visulima/vis/config"` — same module
// they already import `defineConfig`/`definePlugin` from.
export type { OtelPluginOptions, OtelSpan, OtelTracer } from "./plugins/otel";
export { otelPlugin } from "./plugins/otel";
export {
    applyDefaults,
    CONFIG_FILES,
    defineConfig,
    definePlugin,
    defineTaskConfig,
    findVisConfigFile,
    findVisTaskConfigFile,
    loadVisConfig,
    loadVisTaskConfig,
    SECURITY_DEFAULTS,
    TASK_CONFIG_FILES,
};
