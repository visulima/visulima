import type { ChildProcess } from "node:child_process";
import { exec } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { platform } from "node:os";
import { join, resolve } from "@visulima/path";

/**
 * Represents a file access recorded during task execution.
 */
export interface FileAccess {
    /** The absolute path of the file */
    path: string;
    /** The type of access */
    type: "read" | "stat" | "readdir" | "missing";
}

/**
 * Result of tracking file accesses during a command execution.
 */
export interface TrackingResult {
    /** All file accesses recorded */
    accesses: FileAccess[];
    /** The command exit code */
    code: number;
    /** The command stdout + stderr output */
    output: string;
}

/**
 * Tracks which files a child process accesses during execution.
 *
 * Uses `strace` on Linux to intercept syscalls (open, openat, stat, lstat, access, getdents).
 * Falls back to no tracking on unsupported platforms.
 */
export class FileAccessTracker {
    readonly #workspaceRoot: string;

    readonly #excludePatterns: RegExp[];

    /** Tracks active child processes for cleanup on abort */
    readonly #activeProcesses = new Set<ChildProcess>();

    public constructor(workspaceRoot: string, excludePatterns?: RegExp[]) {
        this.#workspaceRoot = resolve(workspaceRoot);
        this.#excludePatterns = excludePatterns ?? [
            /\/proc\//,
            /\/sys\//,
            /\/dev\//,
            /\/tmp\//,
            /\/etc\//,
            /\.so(\.\d+)*$/,
            /node_modules\/.package-lock\.json$/,
        ];
    }

    /**
     * Returns true if file access tracking is supported on the current platform.
     */
    // eslint-disable-next-line class-methods-use-this
    public isSupported(): boolean {
        return platform() === "linux";
    }

    /**
     * Runs a command and tracks all file system accesses.
     * On unsupported platforms, runs the command without tracking.
     */
    public async track(
        command: string,
        options: {
            cwd?: string;
            env?: Record<string, string | undefined>;
        } = {},
    ): Promise<TrackingResult> {
        if (!this.isSupported()) {
            return this.#runWithoutTracking(command, options);
        }

        return this.#runWithStrace(command, options);
    }

    /**
     * Runs a command wrapped with strace to capture file accesses.
     */
    async #runWithStrace(
        command: string,
        options: {
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        const traceDirectory = join(this.#workspaceRoot, "node_modules", ".cache", "task-runner");

        await mkdir(traceDirectory, { recursive: true });
        // eslint-disable-next-line sonarjs/pseudo-random
        const traceFile = join(traceDirectory, `strace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.log`);

        // strace flags:
        // -f: follow forks
        // -e trace=open,openat,stat,lstat,newfstatat,access,getdents,getdents64: track file operations
        // -o: output to file
        // -qq: suppress non-essential messages
        const straceCommand = `strace -f -qq -e trace=open,openat,stat,lstat,newfstatat,access,getdents,getdents64 -o ${traceFile} -- ${command}`;

        return new Promise((_resolve) => {
            // eslint-disable-next-line sonarjs/os-command
            const child = exec(
                straceCommand,
                {
                    cwd: options.cwd ?? this.#workspaceRoot,
                    env: { ...process.env, ...options.env } as Record<string, string>,
                    maxBuffer: 50 * 1024 * 1024, // 50MB
                },
                async (_error, stdout, stderr) => {
                    this.#activeProcesses.delete(child);

                    let accesses: FileAccess[] = [];

                    try {
                        const traceContent = await readFile(traceFile, "utf8");

                        accesses = this.#parseStraceOutput(traceContent, options.cwd ?? this.#workspaceRoot);
                    } catch {
                        // Trace file might not exist if strace isn't available
                    }

                    // Clean up trace file
                    await rm(traceFile, { force: true }).catch(() => {});

                    _resolve({
                        accesses,
                        code: child.exitCode ?? 1,
                        output: stdout + stderr,
                    });
                },
            );

            this.#activeProcesses.add(child);
        });
    }

    /**
     * Parses strace output to extract file accesses.
     */
    #parseStraceOutput(traceContent: string, cwd: string): FileAccess[] {
        const accesses: FileAccess[] = [];
        const seenPaths = new Set<string>();

        for (const line of traceContent.split("\n")) {
            const parsed = this.#parseStraceLine(line, cwd);

            if (parsed && !seenPaths.has(parsed.path)) {
                seenPaths.add(parsed.path);
                accesses.push(parsed);
            }
        }

        return accesses;
    }

    /**
     * Parses a single strace output line.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    #parseStraceLine(line: string, cwd: string): FileAccess | undefined {
        // Match patterns like:
        // openat(AT_FDCWD, "/path/to/file", O_RDONLY) = 3
        // stat("/path/to/file", {st_mode=...}) = 0
        // access("/path/to/file", R_OK) = 0
        // openat(AT_FDCWD, "/path/to/file", O_RDONLY) = -1 ENOENT
        // getdents64(3, ...) = 0

        let path: string | undefined;
        let type: FileAccess["type"] = "read";
        let isMissing = false;

        // Check for ENOENT (file not found)
        if (line.includes("ENOENT")) {
            isMissing = true;
        }

        // Parse openat syscall
        const openatMatch = /openat\(AT_FDCWD,\s*"([^"]+)"/.exec(line);

        if (openatMatch) {
            path = openatMatch[1] as string;
            type = isMissing ? "missing" : "read";
        }

        // Parse open syscall
        if (!path) {
            const openMatch = /^(?:\d+\s+)?open\("([^"]+)"/.exec(line);

            if (openMatch) {
                path = openMatch[1] as string;
                type = isMissing ? "missing" : "read";
            }
        }

        // Parse stat/lstat/newfstatat syscall
        if (!path) {
            const statMatch = /(?:stat|lstat|newfstatat)\((?:AT_FDCWD,\s*)?"([^"]+)"/.exec(line);

            if (statMatch) {
                path = statMatch[1] as string;
                type = isMissing ? "missing" : "stat";
            }
        }

        // Parse access syscall
        if (!path) {
            const accessMatch = /access\("([^"]+)"/.exec(line);

            if (accessMatch) {
                path = accessMatch[1] as string;
                type = isMissing ? "missing" : "stat";
            }
        }

        // Parse getdents/getdents64 - these use FDs so we can't easily get paths
        // Skip these for now; directory tracking is done via openat with O_DIRECTORY

        if (!path) {
            return undefined;
        }

        // Resolve relative paths
        if (!path.startsWith("/")) {
            path = resolve(cwd, path);
        }

        // Filter out system paths and excluded patterns
        if (this.#shouldExclude(path)) {
            return undefined;
        }

        // Only include paths within or related to the workspace
        if (!path.startsWith(this.#workspaceRoot)) {
            return undefined;
        }

        return { path, type };
    }

    /**
     * Checks if a path should be excluded from tracking.
     */
    #shouldExclude(filePath: string): boolean {
        return this.#excludePatterns.some((pattern) => pattern.test(filePath));
    }

    /**
     * Kills all active child processes. Called on abort/signal to prevent orphans.
     */
    public killAll(): void {
        for (const child of this.#activeProcesses) {
            try {
                child.kill("SIGTERM");
            } catch {
                // Process may have already exited
            }
        }

        this.#activeProcesses.clear();
    }

    /**
     * Runs a command without file access tracking.
     */
    async #runWithoutTracking(
        command: string,
        options: {
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        return new Promise((_resolve) => {
            // eslint-disable-next-line sonarjs/os-command
            const child = exec(
                command,
                {
                    cwd: options.cwd ?? this.#workspaceRoot,
                    env: { ...process.env, ...options.env } as Record<string, string>,
                    maxBuffer: 50 * 1024 * 1024,
                },
                (_error, stdout, stderr) => {
                    this.#activeProcesses.delete(child);

                    _resolve({
                        accesses: [],
                        code: child.exitCode ?? 1,
                        output: stdout + stderr,
                    });
                },
            );

            this.#activeProcesses.add(child);
        });
    }
}

/**
 * Generates a preload script that can be used with NODE_OPTIONS to
 * track file accesses in Node.js child processes.
 *
 * This is an alternative to strace that works cross-platform for Node.js processes.
 */
export const generatePreloadScript = (outputPath: string): string => String.raw`
import { createWriteStream } from "node:fs";
import { Module } from "node:module";

const _originalReadFileSync = require("node:fs").readFileSync;
const _originalStatSync = require("node:fs").statSync;
const _originalReaddirSync = require("node:fs").readdirSync;
const _originalReadFile = require("node:fs").readFile;
const _originalStat = require("node:fs").stat;
const _originalReaddir = require("node:fs").readdir;

const logStream = createWriteStream(${JSON.stringify(outputPath)}, { flags: "a" });

const log = (type, path) => {
    logStream.write(JSON.stringify({ type, path }) + "\n");
};

const fs = require("node:fs");

fs.readFileSync = function(...args) {
    log("read", args[0]?.toString());
    return _originalReadFileSync.apply(this, args);
};

fs.statSync = function(...args) {
    log("stat", args[0]?.toString());
    return _originalStatSync.apply(this, args);
};

fs.readdirSync = function(...args) {
    log("readdir", args[0]?.toString());
    return _originalReaddirSync.apply(this, args);
};

// Async variants
const origReadFileCb = _originalReadFile;
fs.readFile = function(...args) {
    log("read", args[0]?.toString());
    return origReadFileCb.apply(this, args);
};

const origStatCb = _originalStat;
fs.stat = function(...args) {
    log("stat", args[0]?.toString());
    return origStatCb.apply(this, args);
};

const origReaddirCb = _originalReaddir;
fs.readdir = function(...args) {
    log("readdir", args[0]?.toString());
    return origReaddirCb.apply(this, args);
};

// Also patch fs/promises
const fsp = require("node:fs/promises");
const origFspReadFile = fsp.readFile;
fsp.readFile = async function(...args) {
    log("read", args[0]?.toString());
    return origFspReadFile.apply(this, args);
};

const origFspStat = fsp.stat;
fsp.stat = async function(...args) {
    log("stat", args[0]?.toString());
    return origFspStat.apply(this, args);
};

const origFspReaddir = fsp.readdir;
fsp.readdir = async function(...args) {
    log("readdir", args[0]?.toString());
    return origFspReaddir.apply(this, args);
};

// Flush and close the log stream before exit
process.on("beforeExit", () => { logStream.end(); });
`;
