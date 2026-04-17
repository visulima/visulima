import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

import { isAbsolute, join } from "@visulima/path";

import { ConfigError } from "./errors";
import type { CustomTask, RunOptions, StagedConfig, StagedTask } from "./types";

const CONFIG_FILE_CANDIDATES = [
    ".vis-staged.json",
    ".vis-staged.yaml",
    ".vis-staged.yml",
    ".vis-staged.js",
    ".vis-staged.mjs",
    ".vis-staged.cjs",
    ".vis-staged.ts",
    ".vis-staged.mts",
    ".vis-staged.cts",
    ".lintstagedrc",
    ".lintstagedrc.json",
    ".lintstagedrc.yaml",
    ".lintstagedrc.yml",
    ".lintstagedrc.js",
    ".lintstagedrc.mjs",
    ".lintstagedrc.cjs",
    ".lintstagedrc.ts",
    ".lintstagedrc.mts",
    ".lintstagedrc.cts",
    "lint-staged.config.js",
    "lint-staged.config.mjs",
    "lint-staged.config.cjs",
    "lint-staged.config.ts",
] as const;

/**
 * Resolves the user's config. Priority:
 *   1. `options.config` — inline object/function (the primary path from `vis staged`).
 *   2. `options.configPath` — explicit config file path.
 *   3. Auto-discovered config file in `cwd`.
 */
export const resolveConfig = async (options: RunOptions): Promise<StagedConfig> => {
    if (options.config !== undefined) {
        return options.config;
    }

    const cwd = options.cwd ?? process.cwd();

    const explicit = options.configPath;

    if (explicit) {
        const absolute = isAbsolute(explicit) ? explicit : join(cwd, explicit);

        if (!existsSync(absolute)) {
            throw new ConfigError(`Staged config not found at ${absolute}`);
        }

        return loadConfigFile(absolute);
    }

    for (const name of CONFIG_FILE_CANDIDATES) {
        const candidate = join(cwd, name);

        if (existsSync(candidate)) {
            return loadConfigFile(candidate);
        }
    }

    throw new ConfigError(
        "No staged config provided. Either pass `staged` in vis.config.ts, pass `config` to runStaged, or place a .vis-staged.* / .lintstagedrc.* file at the project root.",
    );
};

/**
 * Loads a staged config from disk. JSON and YAML are parsed inline; everything else goes through jiti.
 * The extensionless `.lintstagedrc` is parsed as YAML (matching lint-staged v17); since YAML is a
 * JSON superset, legacy JSON content continues to load, but users should rename to `.lintstagedrc.json`
 * for clarity.
 */
const loadConfigFile = async (absolute: string): Promise<StagedConfig> => {
    const ext = extname(absolute);

    if (ext === ".json") {
        return parseJsonConfig(absolute);
    }

    if (ext === ".yaml" || ext === ".yml") {
        return parseYamlConfig(absolute);
    }

    if (absolute.endsWith(".lintstagedrc")) {
        // lint-staged v17 treats the extensionless file as YAML by default.
        // YAML is a superset of JSON so legacy JSON contents continue to parse; renaming to .lintstagedrc.json is still recommended for clarity.
        return parseYamlConfig(absolute);
    }

    const { createJiti } = await import("jiti");
    const jiti = createJiti(absolute, { interopDefault: true });

    try {
        const mod = await jiti.import(absolute, { default: true });

        return (mod as { default?: StagedConfig }).default ?? (mod as StagedConfig);
    } catch (error) {
        throw new ConfigError(`Failed to load config ${absolute}`, { cause: error as Error });
    }
};

const parseJsonConfig = (absolute: string): StagedConfig => {
    try {
        const raw = readFileSync(absolute, "utf8").replace(/^\uFEFF/, "");

        return JSON.parse(raw) as StagedConfig;
    } catch (error) {
        throw new ConfigError(`Failed to parse JSON config ${absolute}`, { cause: error as Error });
    }
};

const parseYamlConfig = async (absolute: string): Promise<StagedConfig> => {
    try {
        const raw = readFileSync(absolute, "utf8");
        const { parse } = await import("yaml");

        return parse(raw) as StagedConfig;
    } catch (error) {
        throw new ConfigError(`Failed to parse YAML config ${absolute}`, { cause: error as Error });
    }
};

/** Validates that a resolved config has the right shape. */
export const validateConfig = (config: unknown): Record<string, StagedTask> => {
    if (typeof config !== "object" || config === null) {
        throw new ConfigError("Staged config must be an object mapping glob patterns to tasks.");
    }

    const entries = Object.entries(config as Record<string, unknown>);

    if (entries.length === 0) {
        throw new ConfigError("Staged config is empty — at least one glob pattern is required.");
    }

    for (const [pattern, value] of entries) {
        if (!pattern || pattern.trim() === "") {
            throw new ConfigError("Staged config keys must be non-empty glob patterns.");
        }

        validateTask(pattern, value);
    }

    return config as Record<string, StagedTask>;
};

const validateTask = (pattern: string, value: unknown): void => {
    if (typeof value === "string") {
        if (value.trim() === "") {
            throw new ConfigError(`Task for "${pattern}" is an empty string.`);
        }

        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            throw new ConfigError(`Task array for "${pattern}" is empty.`);
        }

        for (const item of value) {
            validateTask(pattern, item);
        }

        return;
    }

    if (typeof value === "function") {
        return;
    }

    if (isCustomTask(value)) {
        return;
    }

    throw new ConfigError(`Invalid task for "${pattern}" — expected string, string[], function, or { title, task } object.`);
};

const isCustomTask = (value: unknown): value is CustomTask =>
    typeof value === "object" && value !== null && typeof (value as CustomTask).title === "string" && typeof (value as CustomTask).task === "function";

export { CONFIG_FILE_CANDIDATES };
