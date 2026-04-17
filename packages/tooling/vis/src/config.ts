import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync as fsReadFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";

import { findCacheDirSync } from "@visulima/find-cache-dir";
import { ensureDirSync, isAccessibleSync, readJsonSync, writeJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";
import { createJiti } from "jiti";

import type { VisPlugin } from "./hooks";
import type { VisConfig } from "./workspace";

/** Supported config file names, checked in order. */
const CONFIG_FILES: string[] = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

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
 * @param directory The directory to search in.
 * @returns The absolute path to the config file, or `undefined` if not found.
 */
const findVisConfigFile = (directory: string): string | undefined => {
    for (const file of CONFIG_FILES) {
        const filePath = join(directory, file);

        if (existsSync(filePath)) {
            return filePath;
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

const getConfigCachePath = (workspaceRoot: string): string | undefined => {
    // First try: use node_modules/.cache/vis directly if node_modules exists
    // in the workspace root. This avoids findCacheDirSync traversing to a
    // parent project's node_modules when the workspace root lacks package.json.
    const nodeModulesDir = join(workspaceRoot, "node_modules");

    if (existsSync(nodeModulesDir)) {
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

// ── Config loader ───────────────────────────────────────────────────

/**
 * Load the vis configuration from a `vis.config.ts` (or `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`) file.
 *
 * Uses a file-hash based cache to avoid repeated jiti compilations.
 * Falls back to secure defaults if no config file is found.
 * @param workspaceRoot The workspace root directory to search for the config file.
 * @returns The loaded and resolved configuration with secure defaults applied.
 */
const loadVisConfig = async (workspaceRoot: string): Promise<VisConfig> => {
    const configPath = findVisConfigFile(workspaceRoot);

    if (!configPath) {
        return applyDefaults({});
    }

    // Check cache: hash the config file and compare
    const hash = hashFileContents(configPath);
    const cachePath = getConfigCachePath(workspaceRoot);

    if (cachePath) {
        const cached = readConfigCache(cachePath, hash);

        if (cached) {
            return cached;
        }
    }

    // Cache miss — compile via jiti
    // Copy to a unique temp file to bypass jiti's internal module cache
    // (jiti caches by file path and ignores moduleCache: false for ESM)
    const extension = configPath.slice(configPath.lastIndexOf("."));
    const temporaryConfigPath = join(tmpdir(), `vis-config-${hash}${extension}`);

    copyFileSync(configPath, temporaryConfigPath);

    let loaded: unknown;

    try {
        const jiti = createJiti(workspaceRoot, { fsCache: false, moduleCache: false });

        loaded = (await jiti.import(temporaryConfigPath, { default: true, try: true })) ?? {};
    } finally {
        try {
            unlinkSync(temporaryConfigPath);
        } catch {
            // Non-critical cleanup
        }
    }

    let config: VisConfig;

    config = typeof loaded === "function" ? applyDefaults((await loaded()) ?? {}) : applyDefaults(loaded as VisConfig);

    if (cachePath) {
        writeConfigCache(cachePath, hash, config);
    }

    return config;
};

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
export { applyDefaults, CONFIG_FILES, defineConfig, definePlugin, findVisConfigFile, loadVisConfig, SECURITY_DEFAULTS };
