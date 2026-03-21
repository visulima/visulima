import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import type { FileAccess } from "./file-access-tracker";
import { hashFile, hashStrings, sortObjectKeys } from "./utils";

/**
 * Represents a stored fingerprint for a task execution.
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
    type: "file-changed" | "file-created" | "file-deleted" | "directory-changed" | "env-changed" | "args-changed" | "no-fingerprint";
    detail: string;
    previousHash?: string;
    currentHash?: string;
}

/**
 * Manages task fingerprints for auto-detection caching.
 *
 * Records which files a task accesses during execution, stores content
 * hashes, and on subsequent runs checks if any accessed file has changed.
 */
export class FingerprintManager {
    readonly #workspaceRoot: string;
    readonly #fileHashCache = new Map<string, string | null>();

    constructor(workspaceRoot: string) {
        this.#workspaceRoot = resolve(workspaceRoot);
    }

    async createFingerprint(
        accesses: FileAccess[],
        command: string,
        args: Record<string, unknown>,
        envVars: Record<string, string | undefined>,
        envPatterns: string[] = [],
        untrackedEnvVars: string[] = [],
    ): Promise<TaskFingerprint> {
        const fileHashes: Record<string, string> = {};
        const missingPaths = new Set<string>();
        const directoryListings: Record<string, string[]> = {};

        for (const access of accesses) {
            const relativePath = relative(this.#workspaceRoot, access.path);

            if (access.type === "missing") {
                missingPaths.add(relativePath);
            } else if (access.type === "readdir") {
                if (!directoryListings[relativePath]) {
                    try {
                        const entries = await readdir(access.path);

                        directoryListings[relativePath] = entries.sort();
                    } catch {
                        directoryListings[relativePath] = [];
                    }
                }
            } else if (access.type === "read" || access.type === "stat") {
                if (!fileHashes[relativePath]) {
                    const hash = await this.#hashFileWithCache(access.path);

                    if (hash) {
                        fileHashes[relativePath] = hash;
                    }
                }
            }
        }

        const commandHash = hashStrings(`${command}:${JSON.stringify(sortObjectKeys(args))}`);

        const envHashes: Record<string, string> = {};
        const matchedEnvVars = this.#resolveEnvPatterns(envPatterns, envVars);
        const untrackedSet = new Set(untrackedEnvVars);

        for (const [key, value] of Object.entries(matchedEnvVars)) {
            if (untrackedSet.has(key)) {
                continue;
            }

            envHashes[key] = hashStrings(`${key}=${value ?? ""}`);
        }

        const missingFiles = [...missingPaths].sort();

        return { fileHashes, missingFiles, directoryListings, commandHash, envHashes };
    }

    /**
     * Validates a stored fingerprint against the current state.
     * Returns null if valid (cache hit), or an array of reasons (cache miss).
     *
     * Does NOT use the file hash cache — validation must see current disk state.
     */
    async validate(fingerprint: TaskFingerprint): Promise<CacheMissReason[] | null> {
        const reasons: CacheMissReason[] = [];

        const fileCheckPromises = Object.entries(fingerprint.fileHashes).map(
            async ([relativePath, previousHash]) => {
                const absolutePath = resolve(this.#workspaceRoot, relativePath);
                const currentHash = await hashFile(absolutePath);

                if (!currentHash) {
                    return { type: "file-deleted" as const, detail: relativePath, previousHash };
                }

                if (currentHash !== previousHash) {
                    return { type: "file-changed" as const, detail: relativePath, previousHash, currentHash };
                }

                return null;
            },
        );

        // Parallelize missing file checks
        const missingCheckPromises = fingerprint.missingFiles.map(
            async (relativePath) => {
                const absolutePath = resolve(this.#workspaceRoot, relativePath);

                try {
                    await stat(absolutePath);

                    return { type: "file-created" as const, detail: relativePath };
                } catch {
                    return null;
                }
            },
        );

        // Parallelize directory listing checks
        const dirCheckPromises = Object.entries(fingerprint.directoryListings).map(
            async ([relativePath, previousEntries]) => {
                const absolutePath = resolve(this.#workspaceRoot, relativePath);

                try {
                    const currentEntries = (await readdir(absolutePath)).sort();

                    if (JSON.stringify(previousEntries) !== JSON.stringify(currentEntries)) {
                        return {
                            type: "directory-changed" as const,
                            detail: relativePath,
                            previousHash: JSON.stringify(previousEntries),
                            currentHash: JSON.stringify(currentEntries),
                        };
                    }
                } catch {
                    return { type: "directory-changed" as const, detail: relativePath };
                }

                return null;
            },
        );

        const [fileResults, missingResults, dirResults] = await Promise.all([
            Promise.all(fileCheckPromises),
            Promise.all(missingCheckPromises),
            Promise.all(dirCheckPromises),
        ]);

        for (const r of [...fileResults, ...missingResults, ...dirResults]) {
            if (r) {
                reasons.push(r);
            }
        }

        // Check environment variables (synchronous, no I/O)
        for (const [envName, previousHash] of Object.entries(fingerprint.envHashes)) {
            const currentHash = hashStrings(`${envName}=${process.env[envName] ?? ""}`);

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

    validateCommand(
        fingerprint: TaskFingerprint,
        command: string,
        args: Record<string, unknown>,
    ): CacheMissReason | null {
        const currentHash = hashStrings(`${command}:${JSON.stringify(sortObjectKeys(args))}`);

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

    #resolveEnvPatterns(
        patterns: string[],
        envVars: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        const result: Record<string, string | undefined> = {};

        for (const pattern of patterns) {
            if (pattern.includes("*")) {
                const prefix = pattern.replace("*", "");

                for (const [key, value] of Object.entries(envVars)) {
                    if (key.startsWith(prefix)) {
                        result[key] = value;
                    }
                }
            } else {
                result[pattern] = envVars[pattern];
            }
        }

        return result;
    }

    async #hashFileWithCache(filePath: string): Promise<string | null> {
        const cached = this.#fileHashCache.get(filePath);

        if (cached !== undefined) {
            return cached;
        }

        const hash = await hashFile(filePath);

        this.#fileHashCache.set(filePath, hash);

        return hash;
    }
}
