import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

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

    if (!existsSync(filePath)) {
        return null;
    }

    const raw = readFileSync(filePath, "utf8");
    const stripped = stripJsonComments(raw);
    const hadComments = stripped !== raw;
    const config = JSON.parse(stripped) as DevcontainerConfig;

    return { config, hadComments };
};

/**
 * Write devcontainer.json to disk, creating the directory if needed.
 */
export const writeDevcontainerJson = (workspaceRoot: string, config: DevcontainerConfig, outputPath?: string): void => {
    const dir = outputPath ? dirname(outputPath) : join(workspaceRoot, ".devcontainer");
    const filePath = outputPath ?? join(dir, "devcontainer.json");

    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
};
