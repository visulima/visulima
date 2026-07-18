import type { ChildProcess } from "node:child_process";
import { exec } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { join } from "@visulima/path";

import type { CollectedHints } from "./cache-hints";
import { collectHints, emptyHints, HINTS_ENV, HINTS_PROTOCOL_VERSION, PROTOCOL_ENV } from "./cache-hints";
import type { FileAccess } from "./file-access-tracker";
import { FileAccessTracker, generatePreloadScript, parseDirectExec } from "./file-access-tracker";
import { withEnhancedPath } from "./path-utils";
import type { Task, TaskExecutionOptions } from "./types";
import { isInsideWorkspace, uniqueId } from "./utils";

/**
 * Result of a tracked task execution.
 */
export interface TrackedExecutionResult {
    /** File accesses recorded during execution */
    accesses: FileAccess[];
    /** The command exit code */
    code: number;

    /**
     * Cooperative cache hints the task emitted via
     * `@visulima/task-runner-client` ({@link CollectedHints}). Empty when
     * the task didn't use the client.
     */
    hints: CollectedHints;
    /** The command stdout + stderr output */
    terminalOutput: string;
}

/**
 * A task executor that tracks file accesses during command execution.
 *
 * Tracking strategies (in priority order):
 * 1. **Linux**: strace-based syscall interception (most complete)
 * 2. **macOS/Windows**: Node.js preload script that patches `fs` module
 * (works for Node.js processes, not native binaries)
 * 3. **Fallback**: No tracking (accesses array will be empty)
 */
export class TrackedTaskExecutor {
    readonly #tracker: FileAccessTracker;

    readonly #workspaceRoot: string;

    /** Tracks active child processes for cleanup on abort */
    readonly #activeProcesses = new Set<ChildProcess>();

    public constructor(workspaceRoot: string) {
        this.#workspaceRoot = workspaceRoot;
        this.#tracker = new FileAccessTracker(workspaceRoot);
    }

    /**
     * Returns true if file access tracking is supported on the current platform.
     * strace tracking (Linux) or preload script (any Node.js process).
     */
    // eslint-disable-next-line class-methods-use-this
    public get isTrackingSupported(): boolean {
        // We support tracking on all platforms now via preload script
        return true;
    }

    /**
     * Returns true if the platform supports full syscall-level tracking (strace).
     */
    public get isStraceSupported(): boolean {
        return this.#tracker.isSupported();
    }

    /**
     * Executes a task command and tracks all file system accesses.
     *
     * On Linux, uses strace for comprehensive tracking.
     * On other platforms, uses a Node.js preload script (for Node processes).
     */
    public async execute(task: Task, options: TaskExecutionOptions, command: string): Promise<TrackedExecutionResult> {
        const cwd = options.cwd ?? (task.projectRoot ? join(this.#workspaceRoot, task.projectRoot) : this.#workspaceRoot);

        // Allocate a per-task NDJSON hints file and expose it to the
        // child via env. The cooperative client appends one line per
        // call; we read it back after the child exits. Same cache dir +
        // cleanup discipline as the strace trace / preload log.
        const cacheDirectory = join(this.#workspaceRoot, "node_modules", ".cache", "task-runner");

        await mkdir(cacheDirectory, { recursive: true });

        const hintsFile = join(cacheDirectory, `hints-${uniqueId()}.ndjson`);
        const hintEnv: Record<string, string> = {
            [HINTS_ENV]: hintsFile,
            [PROTOCOL_ENV]: HINTS_PROTOCOL_VERSION,
        };

        try {
            let base: Omit<TrackedExecutionResult, "hints">;

            // Strategy 1: syscall-level tracking (Linux strace/seccomp — most complete).
            // Strategy 2: native injection for directly-exec'd commands only —
            //   macOS DYLD interpose / Windows IAT hooks. Shell-syntax commands
            //   can't be injected (SIP /bin/sh on macOS; no child propagation on
            //   Windows), so they fall through to the preload.
            // Strategy 3: Node preload script (cross-platform, Node.js processes only).
            const trackingEnv = { ...options.env, ...hintEnv };
            const nativeDirect = this.#tracker.isInterposeSupported() || this.#tracker.isIatHookSupported();
            const directArgv = nativeDirect ? parseDirectExec(command) : undefined;

            if (this.#tracker.isSupported()) {
                const trackingResult = await this.#tracker.track(command, { cwd, env: trackingEnv });

                base = {
                    accesses: trackingResult.accesses,
                    code: trackingResult.code,
                    terminalOutput: trackingResult.output,
                };
            } else if (directArgv && this.#tracker.isInterposeSupported()) {
                const trackingResult = await this.#tracker.trackInterpose(directArgv, { cwd, env: trackingEnv });

                base = {
                    accesses: trackingResult.accesses,
                    code: trackingResult.code,
                    terminalOutput: trackingResult.output,
                };
            } else if (directArgv && this.#tracker.isIatHookSupported()) {
                const trackingResult = await this.#tracker.trackIatHook(directArgv, { cwd, env: trackingEnv });

                base = {
                    accesses: trackingResult.accesses,
                    code: trackingResult.code,
                    terminalOutput: trackingResult.output,
                };
            } else {
                base = await this.#executeWithPreload(command, cwd, trackingEnv);
            }

            return { ...base, hints: await this.#readHints(hintsFile, cwd) };
        } finally {
            await rm(hintsFile, { force: true }).catch(() => {});
        }
    }

    /**
     * Reads and parses a task's cooperative-hints file. Returns an empty
     * hint set when the file is absent (the common case — the task
     * didn't use the client).
     */
    // eslint-disable-next-line class-methods-use-this
    async #readHints(hintsFile: string, cwd: string): Promise<CollectedHints> {
        try {
            return collectHints(await readFile(hintsFile, "utf8"), cwd);
        } catch {
            return emptyHints();
        }
    }

    /**
     * Executes a command with a Node.js preload script to track fs accesses.
     * Works on macOS, Windows, and Linux for Node.js-based commands.
     */
    async #executeWithPreload(command: string, cwd: string, env?: Record<string, string>): Promise<Omit<TrackedExecutionResult, "hints">> {
        const cacheDirectory = join(this.#workspaceRoot, "node_modules", ".cache", "task-runner");

        await mkdir(cacheDirectory, { recursive: true });

        const id = uniqueId();
        const logFile = join(cacheDirectory, `preload-${id}.log`);
        const preloadFile = join(cacheDirectory, `preload-${id}.mjs`);

        // Write the preload script
        const scriptContent = generatePreloadScript(logFile);

        await writeFile(preloadFile, scriptContent);

        // After the process exits, how long to wait for its stdout/stderr to
        // close before resolving anyway. A descendant that inherited the pipes
        // (an orphaned browser from a vitest-browser-mode test, a backgrounded
        // job) can hold them open indefinitely; without this bound the run
        // would hang on `close`. See voidzero-dev/vite-task#396.
        const STDIO_DRAIN_GRACE_MS = 2000;

        return new Promise((resolve) => {
            // eslint-disable-next-line sonarjs/os-command
            const child = exec(command, {
                cwd,
                env: withEnhancedPath(
                    {
                        ...process.env,
                        ...env,
                        // `--import` needs a file URL, not a bare path: on Windows
                        // a `C:\…` path is parsed as a `c:` URL scheme and rejected,
                        // so the preload never loads and cooperative hints are lost.
                        NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --import ${pathToFileURL(preloadFile).href}`.trim(),
                    },
                    cwd,
                ),
                maxBuffer: 50 * 1024 * 1024,
            });

            // Capture output ourselves so we can resolve on the process's
            // `exit` (which fires regardless of lingering pipe holders) rather
            // than only on `close` (which waits for every stdio writer).
            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (chunk: Buffer | string) => {
                stdout += chunk.toString();
            });
            child.stderr?.on("data", (chunk: Buffer | string) => {
                stderr += chunk.toString();
            });

            let settled = false;

            const finish = (): void => {
                if (settled) {
                    return;
                }

                settled = true;

                this.#activeProcesses.delete(child);

                (async () => {
                    let accesses: FileAccess[] = [];

                    try {
                        accesses = this.#parsePreloadLog(await readFile(logFile, "utf8"));
                    } catch {
                        // Log file may not exist if command didn't use Node.js
                    }

                    await rm(logFile, { force: true }).catch(() => {});
                    await rm(preloadFile, { force: true }).catch(() => {});

                    resolve({ accesses, code: child.exitCode ?? 1, terminalOutput: stdout + stderr });
                })().catch(() => {});
            };

            // Normal completion: every stdio writer closed → finish now.
            child.on("close", finish);
            // Process exited but `close` may never come if a descendant still
            // holds the pipes — finish after a short grace regardless.
            child.on("exit", () => {
                setTimeout(finish, STDIO_DRAIN_GRACE_MS).unref();
            });
            // Spawn failure (e.g. shell missing) — don't hang.
            child.on("error", finish);

            this.#activeProcesses.add(child);
        });
    }

    /**
     * Kills all active child processes. Called on abort/signal to prevent orphans.
     */
    public killAll(): void {
        this.#tracker.killAll();

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
                const entry = JSON.parse(line) as { path: string; type: string };

                if (entry.path && !seen.has(entry.path)) {
                    seen.add(entry.path);

                    // Only include workspace files
                    if (isInsideWorkspace(this.#workspaceRoot, entry.path)) {
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
