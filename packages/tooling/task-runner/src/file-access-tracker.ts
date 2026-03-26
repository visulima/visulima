import type { ChildProcess } from "node:child_process";
import { exec, execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { platform } from "node:os";
import { join, resolve } from "@visulima/path";

import { uniqueId } from "./utils";

/**
 * Lazily checks whether strace is available on the current system.
 * Caches the result after the first call.
 */
let straceAvailable: boolean | undefined;

const isStraceAvailable = (): boolean => {
    if (straceAvailable === undefined) {
        try {
            execFileSync("strace", ["-V"], { stdio: "ignore" });
            straceAvailable = true;
        } catch {
            straceAvailable = false;
        }
    }

    return straceAvailable;
};

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
 * Strace syscall patterns and their corresponding file access types.
 * Order matters — first match wins.
 */
const STRACE_PATTERNS: ReadonlyArray<{ pattern: RegExp; type: FileAccess["type"] }> = [
    { pattern: /openat\(AT_FDCWD,\s*"([^"]+)"/, type: "read" },
    { pattern: /^(?:\d+\s+)?open\("([^"]+)"/, type: "read" },
    { pattern: /(?:stat|lstat|newfstatat)\((?:AT_FDCWD,\s*)?"([^"]+)"/, type: "stat" },
    { pattern: /access\("([^"]+)"/, type: "stat" },
];

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
        return platform() === "linux" && isStraceAvailable();
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
        const traceFile = join(traceDirectory, `strace-${uniqueId()}.log`);

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
     * Each entry maps a regex to the file access type it represents.
     */
    #parseStraceLine(line: string, cwd: string): FileAccess | undefined {
        const isMissing = line.includes("ENOENT");

        // Try each syscall pattern in order; first match wins
        for (const { pattern, type } of STRACE_PATTERNS) {
            const match = pattern.exec(line);

            if (!match?.[1]) {
                continue;
            }

            let path = match[1];

            if (!path.startsWith("/")) {
                path = resolve(cwd, path);
            }

            if (this.#shouldExclude(path) || !path.startsWith(this.#workspaceRoot)) {
                return undefined;
            }

            return { path, type: isMissing ? "missing" : type };
        }

        return undefined;
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

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const logStream = createWriteStream(${JSON.stringify(outputPath)}, { flags: "a" });
const log = (type, path) => { logStream.write(JSON.stringify({ type, path }) + "\n"); };

// Patch each fs method: save original, replace with logged wrapper
const patch = (obj, method, type) => {
    const orig = obj[method];
    obj[method] = function(...args) {
        log(type, args[0]?.toString());
        return orig.apply(this, args);
    };
};

// Sync
patch(fs, "readFileSync", "read");
patch(fs, "statSync", "stat");
patch(fs, "readdirSync", "readdir");
// Async (callback)
patch(fs, "readFile", "read");
patch(fs, "stat", "stat");
patch(fs, "readdir", "readdir");
// Async (promises)
patch(fsp, "readFile", "read");
patch(fsp, "stat", "stat");
patch(fsp, "readdir", "readdir");

process.on("beforeExit", () => { logStream.end(); });
`;
