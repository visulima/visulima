import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import type { FileAccess } from "./file-access-tracker";

/**
 * Represents a stored fingerprint for a task execution.
 * Contains all the data needed to determine if a cached result is still valid.
 */
export interface TaskFingerprint {
    /** Content hashes of files that were read during execution */
    fileHashes: Record<string, string>;
    /** Paths of files that were probed but didn't exist (ENOENT) */
    missingFiles: string[];
    /** Directory listings recorded during execution (path -> sorted entries) */
    directoryListings: Record<string, string[]>;
    /** Hash of the command arguments */
    commandHash: string;
    /** Hashes of fingerprinted environment variables */
    envHashes: Record<string, string>;
}

/**
 * Describes why a cache miss occurred.
 */
export interface CacheMissReason {
    /** The type of change that caused the miss */
    type: "file-changed" | "file-created" | "file-deleted" | "directory-changed" | "env-changed" | "args-changed" | "no-fingerprint";
    /** The path or variable name that changed */
    detail: string;
    /** Optional previous and current hash values */
    previousHash?: string;
    currentHash?: string;
}

/**
 * Manages task fingerprints for auto-detection caching.
 *
 * Instead of requiring manual input configuration (like Nx),
 * this module automatically determines cache validity by:
 * 1. Recording which files a task actually accesses during execution
 * 2. Storing content hashes of those files
 * 3. On subsequent runs, checking if any accessed file has changed
 *
 * Inspired by Vite Task's zero-config caching approach.
 */
export class FingerprintManager {
    readonly #workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.#workspaceRoot = resolve(workspaceRoot);
    }

    /**
     * Creates a fingerprint from recorded file accesses.
     * Called after a task executes to capture what files it touched.
     */
    async createFingerprint(
        accesses: FileAccess[],
        command: string,
        args: Record<string, unknown>,
        envVars: Record<string, string | undefined>,
        envPatterns: string[] = [],
        untrackedEnvVars: string[] = [],
    ): Promise<TaskFingerprint> {
        const fileHashes: Record<string, string> = {};
        const missingFiles: string[] = [];
        const directoryListings: Record<string, string[]> = {};

        // Process each file access
        for (const access of accesses) {
            const relativePath = this.#toRelativePath(access.path);

            if (access.type === "missing") {
                if (!missingFiles.includes(relativePath)) {
                    missingFiles.push(relativePath);
                }
            } else if (access.type === "readdir") {
                if (!directoryListings[relativePath]) {
                    try {
                        const entries = await readdir(access.path);

                        directoryListings[relativePath] = entries.sort();
                    } catch {
                        // Directory might no longer exist
                        directoryListings[relativePath] = [];
                    }
                }
            } else if (access.type === "read" || access.type === "stat") {
                if (!fileHashes[relativePath]) {
                    const hash = await this.#hashFile(access.path);

                    if (hash) {
                        fileHashes[relativePath] = hash;
                    }
                }
            }
        }

        // Hash the command
        const commandHash = this.#hashString(`${command}:${JSON.stringify(this.#sortObject(args))}`);

        // Hash environment variables (excluding untracked ones)
        const envHashes: Record<string, string> = {};
        const matchedEnvVars = this.#resolveEnvPatterns(envPatterns, envVars);
        const untrackedSet = new Set(untrackedEnvVars);

        for (const [key, value] of Object.entries(matchedEnvVars)) {
            if (untrackedSet.has(key)) {
                continue;
            }

            envHashes[key] = this.#hashString(`${key}=${value ?? ""}`);
        }

        // Sort missing files for deterministic comparison
        missingFiles.sort();

        return {
            fileHashes,
            missingFiles,
            directoryListings,
            commandHash,
            envHashes,
        };
    }

    /**
     * Validates a stored fingerprint against the current state of the filesystem.
     * Returns null if the fingerprint is still valid (cache hit),
     * or an array of reasons why it's invalid (cache miss).
     */
    async validate(fingerprint: TaskFingerprint): Promise<CacheMissReason[] | null> {
        const reasons: CacheMissReason[] = [];

        // Check if any tracked files have changed
        for (const [relativePath, previousHash] of Object.entries(fingerprint.fileHashes)) {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);
            const currentHash = await this.#hashFile(absolutePath);

            if (!currentHash) {
                // File was deleted
                reasons.push({
                    type: "file-deleted",
                    detail: relativePath,
                    previousHash,
                });
            } else if (currentHash !== previousHash) {
                // File content changed
                reasons.push({
                    type: "file-changed",
                    detail: relativePath,
                    previousHash,
                    currentHash,
                });
            }
        }

        // Check if any previously missing files now exist
        for (const relativePath of fingerprint.missingFiles) {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);

            try {
                await stat(absolutePath);
                // File now exists - cache invalid
                reasons.push({
                    type: "file-created",
                    detail: relativePath,
                });
            } catch {
                // Still missing - that's fine
            }
        }

        // Check if directory listings have changed
        for (const [relativePath, previousEntries] of Object.entries(fingerprint.directoryListings)) {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);

            try {
                const currentEntries = (await readdir(absolutePath)).sort();
                const previousStr = JSON.stringify(previousEntries);
                const currentStr = JSON.stringify(currentEntries);

                if (previousStr !== currentStr) {
                    reasons.push({
                        type: "directory-changed",
                        detail: relativePath,
                        previousHash: previousStr,
                        currentHash: currentStr,
                    });
                }
            } catch {
                // Directory no longer exists
                reasons.push({
                    type: "directory-changed",
                    detail: relativePath,
                });
            }
        }

        // Check environment variables
        for (const [envName, previousHash] of Object.entries(fingerprint.envHashes)) {
            const currentValue = process.env[envName] ?? "";
            const currentHash = this.#hashString(`${envName}=${currentValue}`);

            if (currentHash !== previousHash) {
                reasons.push({
                    type: "env-changed",
                    detail: envName,
                    previousHash,
                    currentHash,
                });
            }
        }

        return reasons.length > 0 ? reasons : null;
    }

    /**
     * Validates just the command hash portion of a fingerprint.
     */
    validateCommand(
        fingerprint: TaskFingerprint,
        command: string,
        args: Record<string, unknown>,
    ): CacheMissReason | null {
        const currentHash = this.#hashString(`${command}:${JSON.stringify(this.#sortObject(args))}`);

        if (currentHash !== fingerprint.commandHash) {
            return {
                type: "args-changed",
                detail: "command arguments",
                previousHash: fingerprint.commandHash,
                currentHash,
            };
        }

        return null;
    }

    /**
     * Formats cache miss reasons into human-readable diagnostic messages.
     */
    formatMissReasons(reasons: CacheMissReason[]): string {
        const lines: string[] = ["Cache miss reasons:"];

        for (const reason of reasons) {
            switch (reason.type) {
                case "file-changed": {
                    lines.push(`  - File modified: ${reason.detail}`);
                    break;
                }

                case "file-created": {
                    lines.push(`  - File created (was missing): ${reason.detail}`);
                    break;
                }

                case "file-deleted": {
                    lines.push(`  - File deleted: ${reason.detail}`);
                    break;
                }

                case "directory-changed": {
                    lines.push(`  - Directory contents changed: ${reason.detail}`);
                    break;
                }

                case "env-changed": {
                    lines.push(`  - Environment variable changed: ${reason.detail}`);
                    break;
                }

                case "args-changed": {
                    lines.push(`  - Command arguments changed`);
                    break;
                }

                case "no-fingerprint": {
                    lines.push(`  - No previous fingerprint found (first run)`);
                    break;
                }
            }
        }

        return lines.join("\n");
    }

    /**
     * Resolves environment variable patterns (e.g., "VITE_*") into actual variable names.
     */
    #resolveEnvPatterns(
        patterns: string[],
        envVars: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        const result: Record<string, string | undefined> = {};

        for (const pattern of patterns) {
            if (pattern.includes("*")) {
                // Wildcard pattern
                const prefix = pattern.replace("*", "");

                for (const [key, value] of Object.entries(envVars)) {
                    if (key.startsWith(prefix)) {
                        result[key] = value;
                    }
                }
            } else {
                // Exact match
                result[pattern] = envVars[pattern];
            }
        }

        return result;
    }

    /**
     * Converts an absolute path to a workspace-relative path.
     */
    #toRelativePath(absolutePath: string): string {
        return relative(this.#workspaceRoot, absolutePath);
    }

    /**
     * Hashes a file's content.
     */
    async #hashFile(filePath: string): Promise<string | null> {
        try {
            const content = await readFile(filePath);

            return createHash("sha256").update(content).digest("hex");
        } catch {
            return null;
        }
    }

    /**
     * Hashes a string value.
     */
    #hashString(value: string): string {
        return createHash("sha256").update(value).digest("hex");
    }

    /**
     * Sorts an object's keys for deterministic serialization.
     */
    #sortObject(object: Record<string, unknown>): Record<string, unknown> {
        return Object.keys(object)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = object[key];
                return accumulator;
            }, {});
    }
}
