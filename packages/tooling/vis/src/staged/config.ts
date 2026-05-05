import { ConfigError } from "./errors";
import type { CustomTask, RunOptions, StagedConfig, StagedTask } from "./types";

/**
 * Resolves the user's staged config. We deliberately do NOT auto-discover
 * external `.lintstagedrc*` / `.vis-staged.*` files at runtime — that
 * keeps the config surface to a single place (`vis.config.ts`) and means
 * there's no ambiguity about which file drives a run.
 *
 * Users migrating from lint-staged or nano-staged go through
 * `vis migrate lint-staged` / `vis migrate nano-staged`, which inline
 * the old config into `vis.config.ts` and remove the external files.
 */
export const resolveConfig = async (options: RunOptions): Promise<StagedConfig> => {
    if (options.config !== undefined) {
        return options.config;
    }

    throw new ConfigError(
        "No staged config provided. Add `staged` to your vis.config.ts:\n\n"
        + "  import { defineConfig } from \"@visulima/vis/config\";\n\n"
        + "  export default defineConfig({\n"
        + "    staged: { \"*.ts\": \"eslint --fix\" },\n"
        + "  });\n\n"
        + "Coming from lint-staged or nano-staged? Run `vis migrate lint-staged`"
        + " (or `vis migrate nano-staged`) to move the config in and remove the legacy files.",
    );
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
