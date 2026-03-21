import { exec } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task, TaskExecutionOptions } from "./types";
import type { FileAccess } from "./file-access-tracker";

import { FileAccessTracker, generatePreloadScript } from "./file-access-tracker";

/**
 * Result of a tracked task execution.
 */
export interface TrackedExecutionResult {
    /** The command exit code */
    code: number;
    /** The command stdout + stderr output */
    terminalOutput: string;
    /** File accesses recorded during execution */
    accesses: FileAccess[];
}

/**
 * A task executor that tracks file accesses during command execution.
 *
 * Tracking strategies (in priority order):
 * 1. **Linux**: strace-based syscall interception (most complete)
 * 2. **macOS/Windows**: Node.js preload script that patches `fs` module
 *    (works for Node.js processes, not native binaries)
 * 3. **Fallback**: No tracking (accesses array will be empty)
 */
export class TrackedTaskExecutor {
    readonly #tracker: FileAccessTracker;
    readonly #workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.#workspaceRoot = workspaceRoot;
        this.#tracker = new FileAccessTracker(workspaceRoot);
    }

    /**
     * Returns true if file access tracking is supported on the current platform.
     * strace tracking (Linux) or preload script (any Node.js process).
     */
    get isTrackingSupported(): boolean {
        // We support tracking on all platforms now via preload script
        return true;
    }

    /**
     * Returns true if the platform supports full syscall-level tracking (strace).
     */
    get isStraceSupported(): boolean {
        return this.#tracker.isSupported();
    }

    /**
     * Executes a task command and tracks all file system accesses.
     *
     * On Linux, uses strace for comprehensive tracking.
     * On other platforms, uses a Node.js preload script (for Node processes).
     */
    async execute(
        task: Task,
        options: TaskExecutionOptions,
        command: string,
    ): Promise<TrackedExecutionResult> {
        const cwd = options.cwd
            ?? (task.projectRoot
                ? join(this.#workspaceRoot, task.projectRoot)
                : this.#workspaceRoot);

        // Strategy 1: strace (Linux only, most complete)
        if (this.#tracker.isSupported()) {
            const trackingResult = await this.#tracker.track(command, {
                cwd,
                env: options.env as Record<string, string | undefined>,
            });

            return {
                code: trackingResult.code,
                terminalOutput: trackingResult.output,
                accesses: trackingResult.accesses,
            };
        }

        // Strategy 2: Preload script (cross-platform, Node.js processes only)
        return this.#executeWithPreload(command, cwd, options.env);
    }

    /**
     * Executes a command with a Node.js preload script to track fs accesses.
     * Works on macOS, Windows, and Linux for Node.js-based commands.
     */
    async #executeWithPreload(
        command: string,
        cwd: string,
        env?: Record<string, string>,
    ): Promise<TrackedExecutionResult> {
        const cacheDir = join(this.#workspaceRoot, "node_modules", ".cache", "task-runner");

        await mkdir(cacheDir, { recursive: true });

        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const logFile = join(cacheDir, `preload-${uniqueId}.log`);
        const preloadFile = join(cacheDir, `preload-${uniqueId}.mjs`);

        // Write the preload script
        const scriptContent = generatePreloadScript(logFile);

        await writeFile(preloadFile, scriptContent);

        return new Promise((promiseResolve) => {
            const child = exec(command, {
                cwd,
                env: {
                    ...process.env,
                    ...env,
                    NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --import ${preloadFile}`.trim(),
                } as Record<string, string>,
                maxBuffer: 50 * 1024 * 1024,
            }, async (_error, stdout, stderr) => {
                let accesses: FileAccess[] = [];

                try {
                    const logContent = await readFile(logFile, "utf-8");

                    accesses = this.#parsePreloadLog(logContent);
                } catch {
                    // Log file may not exist if command didn't use Node.js
                }

                // Clean up
                await rm(logFile, { force: true }).catch(() => {});
                await rm(preloadFile, { force: true }).catch(() => {});

                promiseResolve({
                    code: child.exitCode ?? 1,
                    terminalOutput: stdout + stderr,
                    accesses,
                });
            });
        });
    }

    /**
     * Parses the JSON-lines log produced by the preload script.
     */
    #parsePreloadLog(content: string): FileAccess[] {
        const accesses: FileAccess[] = [];
        const seen = new Set<string>();

        for (const line of content.split("\n")) {
            if (!line.trim()) {
                continue;
            }

            try {
                const entry = JSON.parse(line) as { type: string; path: string };

                if (entry.path && !seen.has(entry.path)) {
                    seen.add(entry.path);

                    // Only include workspace files
                    if (entry.path.startsWith(this.#workspaceRoot)) {
                        accesses.push({
                            path: entry.path,
                            type: entry.type as FileAccess["type"],
                        });
                    }
                }
            } catch {
                // Skip malformed lines
            }
        }

        return accesses;
    }
}
