import { createHash } from "node:crypto";
import { readdirSync, readFileSync as fsReadFileSync } from "node:fs";
import { createRequire } from "node:module";

import { findCacheDirSync } from "@visulima/find-cache-dir";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeJsonSync } from "@visulima/fs";
import { dirname, isAbsolute, join } from "@visulima/path";

import { VisConfigCycleError, VisConfigLoadError, VisConfigNotFoundError } from "../errors";
import { importTs } from "../runtime/ts-loader";
import { mergeTargetWithInherit } from "../task/target-merge";
import { assertNoDeprecatedConfigKeys, assertNoDeprecatedTaskKeys } from "./deprecation";
import type { VisConfig, VisTaskConfig } from "./types";

/** Supported config file names, checked in priority order. */
const CONFIG_FILES: string[] = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

/** Set form of `CONFIG_FILES` — kept in sync, used for O(1) membership. */
const CONFIG_FILE_SET = new Set(CONFIG_FILES);

/** Per-package overlay file names, checked in priority order. */
const TASK_CONFIG_FILES: string[] = ["vis.task.ts", "vis.task.mts", "vis.task.cts", "vis.task.js", "vis.task.mjs", "vis.task.cjs"];

const TASK_CONFIG_FILE_SET = new Set(TASK_CONFIG_FILES);

/**
 * Default `security.policies.firstSeen.minutes` applied by `vis init`.
 * 2 days — long enough to filter out most rage-published malware while
 * staying short enough that genuine fixes still land in a working week.
 *
 * Note: this is NOT merged into `SECURITY_DEFAULTS` — leaving it undefined
 * preserves the "no opinion" semantics that downstream drift checks rely
 * on. `vis init` writes the value explicitly into the generated config.
 */
const DEFAULT_MIN_RELEASE_AGE_MINUTES = 2880;

/**
 * Secure-by-default security settings based on npm supply chain best practices.
 *
 * Applied automatically when using `defineConfig()` or `loadVisConfig()`.
 * Users can override any value — their settings always take precedence.
 * @see https://github.com/lirantal/awesome-npm-security-best-practices
 */
const SECURITY_DEFAULTS: NonNullable<VisConfig["security"]> = {
    blockExoticSubdeps: true,
    policies: {
        installScripts: { strict: true },
        publisherChange: { ignoreAfter: 43_200, mode: "no-downgrade" },
    },
};

/**
 * Deep-merge user security settings with secure defaults.
 * User-provided values always win, but unspecified sub-keys inherit defaults.
 */
const mergeSecurityDefaults = (security: VisConfig["security"]): VisConfig["security"] => {
    if (!security) {
        return { ...SECURITY_DEFAULTS };
    }

    const defaultPolicies = SECURITY_DEFAULTS.policies ?? {};
    const userPolicies = security.policies ?? {};
    // Generic two-level merge so any new default sub-policy added to
    // `SECURITY_DEFAULTS.policies` picks up the same merge semantics
    // without further code changes.
    const mergedPolicies: NonNullable<VisConfig["security"]>["policies"] = { ...defaultPolicies, ...userPolicies };

    for (const key of Object.keys(defaultPolicies) as (keyof typeof defaultPolicies)[]) {
        const defaultValue = defaultPolicies[key];
        const userValue = userPolicies[key];

        if (defaultValue !== undefined && userValue !== undefined) {
            mergedPolicies[key] = { ...defaultValue, ...userValue } as never;
        }
    }

    return {
        ...SECURITY_DEFAULTS,
        ...security,
        policies: mergedPolicies,
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
const hashConfigChain = (paths: ReadonlyArray<string>): string => {
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
const resolveExtendsSpecifier = (specifier: string, parentFile: string, chain: ReadonlyArray<string>): string => {
    if (isAbsolute(specifier)) {
        throw new VisConfigNotFoundError(
            specifier,
            [...chain, parentFile],
            ["Absolute paths in `extends` are not supported. Use a relative path or an npm package name."],
        );
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

/**
 * Load a single config file via jiti and return its raw export. Wraps
 * any throw in `VisConfigLoadError` so a syntax error surfaces with the
 * source path instead of bubbling up as a workspace.ts failure.
 */
const loadRawConfig = async (configPath: string, chain: ReadonlyArray<string>): Promise<VisConfig> => {
    let loaded: unknown;

    try {
        // `importTs` transpiles TS via vis-native (oxc) and cache-busts each call,
        // so a re-read always sees fresh module state (no stale config).
        const namespace = await importTs(configPath);

        loaded = namespace["default"] ?? {};
    } catch (error) {
        throw new VisConfigLoadError(configPath, chain, error);
    }

    try {
        return (typeof loaded === "function" ? ((await (loaded as () => VisConfig | Promise<VisConfig>)()) ?? {}) : (loaded as VisConfig)) ?? {};
    } catch (error) {
        throw new VisConfigLoadError(configPath, chain, error);
    }
};

/**
 * Merge two `VisConfig` objects — child wins. Most top-level fields are
 * shallow-merged; `tasks` runs through {@link mergeTargetWithInherit}
 * so the `@inherit` sentinel works across the extends chain;
 * `scopedTasks` blocks concatenate (parent first, child last), which
 * preserves the existing "later block wins" precedence.
 */
const mergeVisConfigs = (parent: VisConfig, child: VisConfig): VisConfig => {
    const merged: VisConfig = { ...parent, ...child };

    if (parent.tasks || child.tasks) {
        const names = new Set<string>([...Object.keys(parent.tasks ?? {}), ...Object.keys(child.tasks ?? {})]);
        const out: NonNullable<VisConfig["tasks"]> = {};

        for (const name of names) {
            out[name] = mergeTargetWithInherit(parent.tasks?.[name], child.tasks?.[name]);
        }

        merged.tasks = out;
    }

    if (parent.scopedTasks || child.scopedTasks) {
        merged.scopedTasks = [...(parent.scopedTasks ?? []), ...(child.scopedTasks ?? [])];
    }

    if (parent.fileGroups || child.fileGroups) {
        merged.fileGroups = { ...parent.fileGroups, ...child.fileGroups };
    }

    if (parent.taskGroups || child.taskGroups) {
        merged.taskGroups = { ...parent.taskGroups, ...child.taskGroups };
    }

    if (parent.security || child.security) {
        // Deep-merge `policies` and `acceptedRisks` so a preset that sets
        // `security.policies.installScripts.allow` isn't wiped when the
        // consumer config sets `security.policies.installScripts.strict`.
        // Per-policy bodies are merged one level deep — matches
        // `mergeSecurityDefaults`.
        const parentPolicies = parent.security?.policies ?? {};
        const childPolicies = child.security?.policies ?? {};
        const mergedPolicies: NonNullable<VisConfig["security"]>["policies"] = { ...parentPolicies, ...childPolicies };

        for (const key of Object.keys(parentPolicies) as (keyof typeof parentPolicies)[]) {
            const parentValue = parentPolicies[key];
            const childValue = childPolicies[key];

            if (parentValue !== undefined && childValue !== undefined) {
                mergedPolicies[key] = { ...parentValue, ...childValue } as never;
            }
        }

        merged.security = {
            ...parent.security,
            ...child.security,
            acceptedRisks: { ...parent.security?.acceptedRisks, ...child.security?.acceptedRisks },
            policies: mergedPolicies,
        };
    }

    if (parent.update || child.update) {
        merged.update = { ...parent.update, ...child.update };
    }

    if (parent.taskRunner || child.taskRunner) {
        merged.taskRunner = { ...parent.taskRunner, ...child.taskRunner };
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
    configPath: string,
    chain: ReadonlyArray<string>,
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
        const raw = await loadRawConfig(configPath, chain);

        assertNoDeprecatedConfigKeys(configPath, chain, raw);

        const extendsList = normalizeExtends(raw.extends);

        for (const specifier of extendsList) {
            const resolved = resolveExtendsSpecifier(specifier, configPath, chain);

            await resolveConfigChain(resolved, [...chain, configPath], inFlight, loaded, order);
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
 * @param options Optional loader options.
 * @param options.explicitConfigPath Overrides discovery — used by the
 * global `--config` flag so users can point at any file regardless of
 * cwd. The path must exist; otherwise an error is thrown so the
 * config-loader plugin can surface it to the user.
 * @returns The loaded and resolved configuration with secure defaults applied.
 */
const loadVisConfig = async (workspaceRoot: string, options?: { explicitConfigPath?: string }): Promise<VisConfig> => {
    let rootConfigPath: string | undefined;

    if (options?.explicitConfigPath) {
        const resolved = isAbsolute(options.explicitConfigPath) ? options.explicitConfigPath : join(workspaceRoot, options.explicitConfigPath);

        if (!isAccessibleSync(resolved)) {
            throw new Error(`Cannot find config file at ${resolved}`);
        }

        rootConfigPath = resolved;
    } else {
        rootConfigPath = findVisConfigFile(workspaceRoot);
    }

    if (!rootConfigPath) {
        return applyDefaults({});
    }

    const inFlight = new Set<string>();
    const loaded = new Map<string, VisConfig>();
    const order: string[] = [];

    await resolveConfigChain(rootConfigPath, [], inFlight, loaded, order);

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

interface VisTaskConfigCache {
    config: VisTaskConfig;
    hash: string;
}

const sanitizeProjectName = (projectName: string): string => projectName.replaceAll(/[^\w.-]+/g, "_");

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
 * `node_modules/.cache/vis/task-configs/&lt;project>.json`, keyed by the
 * file's content hash. Editing one project's overlay does not invalidate
 * the root config cache.
 *
 * Errors thrown by the file are wrapped in `VisConfigLoadError` so the
 * source path is reported instead of an opaque workspace.ts failure.
 * @param workspaceRoot Absolute workspace root path (cache scope).
 * @param projectDirectory Absolute path of the project to probe.
 * @param projectName Project identifier — used to scope the cache file.
 */
const loadVisTaskConfig = async (workspaceRoot: string, projectDirectory: string, projectName: string): Promise<VisTaskConfig | undefined> => {
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

    // loadRawConfig validates against VisConfig-shaped keys; vis.task.ts
    // has its own (smaller) deprecation set, so re-run a task-specific check.
    const raw = await loadRawConfig(taskConfigPath, []);

    assertNoDeprecatedTaskKeys(taskConfigPath, [], raw);

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
 *
 * Pure typed-identity — returns its argument unchanged. The point is purely
 * editor autocomplete and structural type-checking on the literal you pass
 * in. Secure defaults are applied by `loadVisConfig` at load time, not here,
 * so wrapping vs. using `satisfies VisConfig` produces the exact same
 * runtime behavior. To see the active defaults, run `vis check --security-config`.
 * @example
 * ```typescript
 * // vis.config.ts — minimal config, fully secured by defaults
 * import { defineConfig } from "@visulima/vis/config";
 *
 * export default defineConfig({
 *     security: {
 *         policies: {
 *             installScripts: {
 *                 allow: {
 *                     esbuild: true,
 *                     "@prisma/client": true,
 *                 },
 *             },
 *         },
 *     },
 * });
 * ```
 */
const defineConfig = (config: VisConfig): VisConfig => config;

// Ship the OTel plugin from the `/config` subpath so users can
// `import { otelPlugin } from "@visulima/vis/config"` — same module
// they already import `defineConfig`/`definePlugin` from.
export type { OtelPluginOptions } from "../plugins/otel";
export { otelPlugin } from "../plugins/otel";
export type { FingerprintContributor, VisHooks, VisPlugin } from "../util/hooks";
export { definePlugin } from "./define-plugin";
export type { VisConfig, VisTaskConfig } from "./types";
export {
    applyDefaults,
    CONFIG_FILES,
    DEFAULT_MIN_RELEASE_AGE_MINUTES,
    defineConfig,
    defineTaskConfig,
    findVisConfigFile,
    findVisTaskConfigFile,
    loadVisConfig,
    loadVisTaskConfig,
    SECURITY_DEFAULTS,
    TASK_CONFIG_FILES,
};
