import { existsSync } from "node:fs";

import { join } from "@visulima/path";
import { createJiti } from "jiti";

import type { VisConfig } from "./workspace";

/** Supported config file names, checked in order. */
const CONFIG_FILES: string[] = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

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

/**
 * Load the vis configuration from a `vis.config.ts` (or `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`) file.
 *
 * Uses jiti for runtime TypeScript support — no build step needed for config files.
 * Falls back to an empty config if no config file is found.
 * @param workspaceRoot The workspace root directory to search for the config file.
 * @returns The loaded and resolved configuration.
 */
const loadVisConfig = async (workspaceRoot: string): Promise<VisConfig> => {
    const configPath = findVisConfigFile(workspaceRoot);

    if (!configPath) {
        return {};
    }

    const jiti = createJiti(workspaceRoot);

    const loaded = (await jiti.import(configPath, { default: true, try: true }) ?? {}) as
        | VisConfig
        | ((...arguments_: unknown[]) => VisConfig | Promise<VisConfig>);

    if (typeof loaded === "function") {
        return (await loaded()) as VisConfig;
    }

    return loaded;
};

/**
 * Type-safe helper for defining vis configuration.
 * Provides full TypeScript autocomplete when used in `vis.config.ts`.
 * @example
 * ```typescript
 * // vis.config.ts
 * import { defineConfig } from "@visulima/vis/config";
 *
 * export default defineConfig({
 *     update: {
 *         target: "minor",
 *         exclude: ["@types/*"],
 *         security: true,
 *     },
 *     ai: {
 *         provider: "claude",
 *     },
 * });
 * ```
 */
const defineConfig = (config: VisConfig): VisConfig => config;

export { CONFIG_FILES, defineConfig, findVisConfigFile, loadVisConfig };
