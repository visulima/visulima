import { readdir, stat } from "node:fs/promises";

import { relative, resolve } from "@visulima/path";

import type { FileAccess } from "./file-access-tracker";
import { hashFile, hashStrings, sortObjectKeys } from "./utils";

/**
 * Represents a stored fingerprint for a task execution.
 */
export interface TaskFingerprint {
    /** Hash of the command arguments */
    commandHash: string;
    /** Directory listings recorded during execution (path -> sorted entries) */
    directoryListings: Record<string, string[]>;
    /** Hashes of fingerprinted environment variables */
    envHashes: Record<string, string>;
    /** Content hashes of files that were read during execution */
    fileHashes: Record<string, string>;
    /** Paths of files that were probed but didn't exist (ENOENT) */
    missingFiles: string[];

    /**
     * Workspace-relative paths that were both read **and** written
     * during execution. Populated when the tracker emits
     * {@link FileAccess} entries with `"write"` type. The orchestrator
     * uses a non-empty value here to skip caching a self-modifying
     * task, whose fingerprint would otherwise capture post-write state
     * and trigger false cache hits.
     */
    modifiedInputs?: string[];
}

/**
 * Describes why a cache miss occurred.
 */
export interface CacheMissReason {
    currentHash?: string;
    detail: string;
    previousHash?: string;
    type: "file-changed" | "file-created" | "file-deleted" | "directory-changed" | "env-changed" | "args-changed" | "no-fingerprint";
}

/**
 * Manages task fingerprints for auto-detection caching.
 *
 * Records which files a task accesses during execution, stores content
 * hashes, and on subsequent runs checks if any accessed file has changed.
 */
export class FingerprintManager {
    readonly #workspaceRoot: string;

    readonly #fileHashCache = new Map<string, string | undefined>();

    public constructor(workspaceRoot: string) {
        this.#workspaceRoot = resolve(workspaceRoot);
    }

    public async createFingerprint(
        accesses: FileAccess[],
        command: string,
        args: Record<string, unknown>,
        envVariables: Record<string, string | undefined>,
        envPatterns: string[] = [],
        untrackedEnvVariables: string[] = [],
    ): Promise<TaskFingerprint> {
        const fileHashes: Record<string, string> = {};
        const missingPaths = new Set<string>();
        const directoryListings: Record<string, string[]> = {};
        const readPaths = new Set<string>();
        const writePaths = new Set<string>();

        for (const access of accesses) {
            const relativePath = relative(this.#workspaceRoot, access.path);

            switch (access.type) {
                case "missing": {
                    missingPaths.add(relativePath);

                    break;
                }
                case "read":
                case "stat": {
                    readPaths.add(relativePath);

                    if (!fileHashes[relativePath]) {
                        // eslint-disable-next-line no-await-in-loop
                        const hash = await this.#hashFileWithCache(access.path);

                        if (hash) {
                            fileHashes[relativePath] = hash;
                        }
                    }

                    break;
                }
                case "readdir": {
                    if (!directoryListings[relativePath]) {
                        try {
                            // eslint-disable-next-line no-await-in-loop
                            const entries = await readdir(access.path);

                            directoryListings[relativePath] = entries.toSorted();
                        } catch {
                            directoryListings[relativePath] = [];
                        }
                    }

                    break;
                }
                case "write": {
                    writePaths.add(relativePath);

                    break;
                }
                default: {
                    break;
                }
            }
        }

        // Self-modifying inputs = files the task read *and* wrote.
        const modifiedInputs: string[] = [];

        for (const path of writePaths) {
            if (readPaths.has(path)) {
                modifiedInputs.push(path);
            }
        }

        modifiedInputs.sort();

        const commandHash = hashStrings(`${command}:${JSON.stringify(sortObjectKeys(args))}`);

        const envHashes: Record<string, string> = {};
        const matchedEnvVariables = FingerprintManager.#resolveEnvPatterns(envPatterns, envVariables);
        const untrackedSet = new Set(untrackedEnvVariables);

        for (const [key, value] of Object.entries(matchedEnvVariables)) {
            if (untrackedSet.has(key)) {
                continue;
            }

            envHashes[key] = hashStrings(`${key}=${value ?? ""}`);
        }

        const missingFiles = [...missingPaths].toSorted();

        return {
            commandHash,
            directoryListings,
            envHashes,
            fileHashes,
            missingFiles,
            ...(modifiedInputs.length > 0 ? { modifiedInputs } : {}),
        };
    }

    /**
     * Validates a stored fingerprint against the current state.
     * Returns null if valid (cache hit), or an array of reasons (cache miss).
     *
     * Does NOT use the file hash cache — validation must see current disk state.
     */
    public async validate(fingerprint: TaskFingerprint): Promise<CacheMissReason[] | undefined> {
        const reasons: CacheMissReason[] = [];

        const fileCheckPromises = Object.entries(fingerprint.fileHashes).map(async ([relativePath, previousHash]) => {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);
            const currentHash = await hashFile(absolutePath);

            if (!currentHash) {
                return { detail: relativePath, previousHash, type: "file-deleted" as const };
            }

            if (currentHash !== previousHash) {
                return { currentHash, detail: relativePath, previousHash, type: "file-changed" as const };
            }

            return undefined;
        });

        // Parallelize missing file checks
        const missingCheckPromises = fingerprint.missingFiles.map(async (relativePath) => {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);

            try {
                await stat(absolutePath);

                return { detail: relativePath, type: "file-created" as const };
            } catch {
                return undefined;
            }
        });

        // Parallelize directory listing checks
        const directoryCheckPromises = Object.entries(fingerprint.directoryListings).map(async ([relativePath, previousEntries]) => {
            const absolutePath = resolve(this.#workspaceRoot, relativePath);

            try {
                const readdirResult = await readdir(absolutePath);
                const currentEntries = readdirResult.toSorted();

                if (JSON.stringify(previousEntries) !== JSON.stringify(currentEntries)) {
                    return {
                        currentHash: JSON.stringify(currentEntries),
                        detail: relativePath,
                        previousHash: JSON.stringify(previousEntries),
                        type: "directory-changed" as const,
                    };
                }
            } catch {
                return { detail: relativePath, type: "directory-changed" as const };
            }

            return undefined;
        });

        const [fileResults, missingResults, directoryResults] = await Promise.all([
            Promise.all(fileCheckPromises),
            Promise.all(missingCheckPromises),
            Promise.all(directoryCheckPromises),
        ]);

        for (const r of [...fileResults, ...missingResults, ...directoryResults]) {
            if (r) {
                reasons.push(r);
            }
        }

        // Check environment variables (synchronous, no I/O)
        for (const [envName, previousHash] of Object.entries(fingerprint.envHashes)) {
            const currentHash = hashStrings(`${envName}=${process.env[envName] ?? ""}`);

            if (currentHash !== previousHash) {
                reasons.push({
                    currentHash,
                    detail: envName,
                    previousHash,
                    type: "env-changed",
                });
            }
        }

        return reasons.length > 0 ? reasons : undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public validateCommand(fingerprint: TaskFingerprint, command: string, args: Record<string, unknown>): CacheMissReason | undefined {
        const currentHash = hashStrings(`${command}:${JSON.stringify(sortObjectKeys(args))}`);

        if (currentHash !== fingerprint.commandHash) {
            return {
                currentHash,
                detail: "command arguments",
                previousHash: fingerprint.commandHash,
                type: "args-changed",
            };
        }

        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    public formatMissReasons(reasons: CacheMissReason[]): string {
        const lines: string[] = ["Cache miss reasons:"];

        for (const reason of reasons) {
            switch (reason.type) {
                case "args-changed": {
                    lines.push(`  - Command arguments changed`);
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

                case "no-fingerprint": {
                    lines.push(`  - No previous fingerprint found (first run)`);
                    break;
                }
                default: {
                    break;
                }
            }
        }

        return lines.join("\n");
    }

    static #resolveEnvPatterns(patterns: string[], envVariables: Record<string, string | undefined>): Record<string, string | undefined> {
        const result: Record<string, string | undefined> = {};

        for (const pattern of patterns) {
            if (pattern.includes("*")) {
                const prefix = pattern.replace("*", "");

                for (const [key, value] of Object.entries(envVariables)) {
                    if (key.startsWith(prefix)) {
                        result[key] = value;
                    }
                }
            } else {
                result[pattern] = envVariables[pattern];
            }
        }

        return result;
    }

    async #hashFileWithCache(filePath: string): Promise<string | undefined> {
        const cached = this.#fileHashCache.get(filePath);

        if (cached !== undefined) {
            return cached;
        }

        const hash = (await hashFile(filePath)) ?? undefined;

        this.#fileHashCache.set(filePath, hash);

        return hash;
    }
}
