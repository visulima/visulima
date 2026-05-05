import { writeFileSync } from "node:fs";

import { ensureDirSync, isAccessibleSync, readFileSync } from "@visulima/fs";
import { stripJsonComments } from "@visulima/fs/utils";
import { dirname, join } from "@visulima/path";

import type { DevcontainerConfig } from "./types";

export interface ReadResult {
    config: DevcontainerConfig;
    hadComments: boolean;
}

/**
 * Read and parse .devcontainer/devcontainer.json with JSONC support.
 * Returns null if the file doesn't exist.
 */
export const readDevcontainerJson = (workspaceRoot: string): ReadResult | null => {
    const filePath = join(workspaceRoot, ".devcontainer", "devcontainer.json");

    if (!isAccessibleSync(filePath)) {
        return null;
    }

    const raw = readFileSync(filePath);
    const stripped = stripJsonComments(raw);
    const hadComments = stripped !== raw;

    let config: DevcontainerConfig;

    try {
        config = JSON.parse(stripped) as DevcontainerConfig;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`Failed to parse ${filePath}: ${message}`, { cause: error });
    }

    return { config, hadComments };
};

/**
 * Write devcontainer.json to disk, creating the directory if needed.
 */
export const writeDevcontainerJson = (workspaceRoot: string, config: DevcontainerConfig, outputPath?: string): void => {
    const dir = outputPath ? dirname(outputPath) : join(workspaceRoot, ".devcontainer");
    const filePath = outputPath ?? join(dir, "devcontainer.json");

    ensureDirSync(dir);
    writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};
