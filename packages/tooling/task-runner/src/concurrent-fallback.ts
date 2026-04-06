/**
 * Pure JavaScript fallback for the concurrent process runner.
 * Used when the native Rust addon is not available.
 *
 * SECURITY NOTE: Commands executed here originate from package.json scripts
 * (trusted input, not user-supplied). Shell execution via spawn() with
 * explicit shell binary (sh -c / cmd.exe /s /c) is intentional -- package
 * scripts require shell features (pipes, redirects, env expansion).
 * This is the same approach used by npm/pnpm/yarn themselves.
 */

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import type { ConcurrentCloseEvent, ConcurrentCommandConfig, ConcurrentRunResult, ConcurrentRunnerOptions, ProcessEvent } from "./types";

interface ActiveProcess {
    child: ChildProcess;
    index: number;
    startTime: [number, number]; // hrtime
}

/**
 * Evaluate success condition against close events.
 */
const evaluateSuccess = (events: ConcurrentCloseEvent[], condition: string): boolean => {
    if (events.length === 0) {
        return true;
    }

    const normalized = condition.trim().toLowerCase();

    if (normalized === "first") {
        return events[0]!.exitCode === 0;
    }

    if (normalized === "last") {
        return events.at(-1)!.exitCode === 0;
    }

    const commandMatch = /^(!?)command-(.+)$/.exec(normalized);

    if (commandMatch) {
        const [, negated, target] = commandMatch;
        const isNegated = negated === "!";
        const matching = events.filter((e) => e.name === target || String(e.index) === target);

        if (isNegated) {
            return events.filter((e) => !matching.includes(e)).every((e) => e.exitCode === 0);
        }

        return matching.length > 0 && matching.every((e) => e.exitCode === 0);
    }

    // Default: "all"
    return events.every((e) => e.exitCode === 0);
};

/**
 * Kill a process tree by PID.
 * Unix: sends signal to the process group (negative PID).
 * Windows: uses taskkill /T for tree kill.
 */
const killTree = (pid: number, signal: string): void => {
    try {
        if (process.platform === "win32") {
            // taskkill /T kills the process tree; spawn is used here only to
            // invoke the system utility, not to run user commands.
            spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
        } else {
            // Kill the process group (created via detached: true)
            process.kill(-pid, signal as NodeJS.Signals);
        }
    } catch {
        // Process may already be dead
    }
};

/**
 * Spawn a single command and wire up event streaming.
 *
 * Commands are sourced from package.json scripts (trusted).
 * Shell execution is intentional for pipe/redirect/env support.
 */
const spawnCommand = (
    index: number,
    config: ConcurrentCommandConfig,
    shellPath: string | undefined,
    onEvent: (event: ProcessEvent) => void,
    onComplete: (closeEvent: ConcurrentCloseEvent) => void,
): ActiveProcess => {
    const startTime = process.hrtime();
    const useShell = config.shell !== false;

    // Stdin mode: "null" (default), "pipe", or "inherit"
    const stdinMode = config.stdin ?? "null";
    const stdinStdio = stdinMode === "inherit" ? "inherit" : stdinMode === "pipe" ? "pipe" : "ignore";

    let child;

    if (useShell) {
        // Shell execution -- commands come from package.json scripts (trusted).
        // Use custom shell if provided (e.g. from npm script-shell config).
        let shellProgram: string;
        let shellArgs: string[];
        let verbatimArgs = false;

        if (shellPath) {
            // Custom shell (Git Bash, etc.) -- always POSIX-style -c
            shellProgram = shellPath;
            shellArgs = ["-c", config.command];
        } else if (process.platform === "win32") {
            shellProgram = "cmd.exe";
            shellArgs = ["/s", "/c", `"${config.command}"`];
            verbatimArgs = true;
        } else {
            shellProgram = "/bin/sh";
            shellArgs = ["-c", config.command];
        }

        child = spawn(shellProgram, shellArgs, {
            cwd: config.cwd,
            detached: process.platform !== "win32",
            env: {
                ...process.env,
                ...config.env,
                FORCE_COLOR: process.env["FORCE_COLOR"] ?? "1",
            },
            stdio: [stdinStdio, "pipe", "pipe"],
            windowsVerbatimArguments: verbatimArgs,
        });
    } else {
        // Direct execution -- no shell wrapping
        const parts = config.command.split(/\s+/);
        const program = parts[0]!;
        const args = parts.slice(1);

        child = spawn(program, args, {
            cwd: config.cwd,
            detached: process.platform !== "win32",
            env: {
                ...process.env,
                ...config.env,
                FORCE_COLOR: process.env["FORCE_COLOR"] ?? "1",
            },
            stdio: [stdinStdio, "pipe", "pipe"],
        });
    }

    // Stream stdout line by line
    let stdoutBuffer = "";
    child.stdout?.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");

        // Keep the last incomplete line in the buffer
        stdoutBuffer = lines.pop()!;

        for (const line of lines) {
            onEvent({ index, kind: "stdout", text: line });
        }
    });

    // Flush remaining stdout on close
    child.stdout?.on("end", () => {
        if (stdoutBuffer) {
            onEvent({ index, kind: "stdout", text: stdoutBuffer });
            stdoutBuffer = "";
        }
    });

    // Stream stderr line by line
    let stderrBuffer = "";
    child.stderr?.on("data", (data: Buffer) => {
        stderrBuffer += data.toString();
        const lines = stderrBuffer.split("\n");

        stderrBuffer = lines.pop()!;

        for (const line of lines) {
            onEvent({ index, kind: "stderr", text: line });
        }
    });

    child.stderr?.on("end", () => {
        if (stderrBuffer) {
            onEvent({ index, kind: "stderr", text: stderrBuffer });
            stderrBuffer = "";
        }
    });

    child.on("error", (error: Error) => {
        onEvent({ index, kind: "error", message: error.message });
    });

    child.on("close", (code, signal) => {
        const elapsed = process.hrtime(startTime);
        const durationMs = elapsed[0] * 1000 + elapsed[1] / 1_000_000;

        const exitCode = code ?? (signal ? 1 : -1);

        const closeEvent: ConcurrentCloseEvent = {
            command: config.command,
            durationMs,
            exitCode,
            index,
            killed: signal !== null,
            name: config.name,
        };

        onEvent({
            commandName: config.name,
            durationMs,
            exitCode,
            index,
            killed: signal !== null,
            kind: "close",
        });

        onComplete(closeEvent);
    });

    return { child, index, startTime };
};

/**
 * Run commands concurrently using pure JavaScript (child_process.spawn).
 * This is the fallback when the native Rust addon is unavailable.
 */
export const runConcurrentFallback = (commands: ConcurrentCommandConfig[], options: ConcurrentRunnerOptions): Promise<ConcurrentRunResult> => {
    return new Promise((resolve) => {
        if (commands.length === 0) {
            resolve({ closeEvents: [], success: true });
            return;
        }

        const maxProcesses = options.maxProcesses && options.maxProcesses > 0 ? options.maxProcesses : commands.length;
        const killSignal = options.killSignal ?? "SIGTERM";
        const killOthers = options.killOthers ?? [];
        const successCondition = options.successCondition ?? "all";
        const onEvent = options.onEvent ?? (() => {});

        const active: ActiveProcess[] = [];
        const closeEvents: ConcurrentCloseEvent[] = [];
        const pending = commands.map((_, i) => i);
        let aborting = false;
        let sigintAbort = false;

        const killAll = (): void => {
            for (const proc of active) {
                if (proc.child.pid) {
                    killTree(proc.child.pid, killSignal);
                }
            }
        };

        const shouldKillOthers = (event: ConcurrentCloseEvent): boolean => {
            for (const condition of killOthers) {
                if (condition === "failure" && event.exitCode !== 0) {
                    return true;
                }

                if (condition === "success" && event.exitCode === 0) {
                    return true;
                }
            }
            return false;
        };

        const maybeSpawnMore = (): void => {
            while (active.length < maxProcesses && pending.length > 0) {
                const cmdIndex = pending.shift()!;
                const config = commands[cmdIndex]!;

                const proc = spawnCommand(cmdIndex, config, options.shellPath, onEvent, (closeEvent) => {
                    // Remove from active
                    const idx = active.findIndex((p) => p.index === cmdIndex);
                    if (idx !== -1) {
                        active.splice(idx, 1);
                    }

                    if (aborting) {
                        closeEvent.killed = true;
                        // SIGINT (Ctrl+C) translates to exit code 0 -- user cancellation
                        // is not a failure. Matches concurrently behavior.
                        if (sigintAbort) {
                            closeEvent.exitCode = 0;
                        }
                    }

                    closeEvents.push(closeEvent);

                    // Check kill-others
                    if (!aborting && shouldKillOthers(closeEvent)) {
                        aborting = true;
                        killAll();
                    }

                    // Spawn more or finish
                    if (!aborting) {
                        maybeSpawnMore();
                    }

                    if (active.length === 0 && pending.length === 0) {
                        const success = evaluateSuccess(closeEvents, successCondition);
                        resolve({ closeEvents, success });
                    }
                });

                active.push(proc);
            }
        };

        // Handle signals -- clean up listeners when done
        const handleSigint = (): void => {
            if (!aborting) {
                aborting = true;
                sigintAbort = true;
                killAll();
            }
        };

        const handleSigterm = (): void => {
            if (!aborting) {
                aborting = true;
                killAll();
            }
        };

        process.on("SIGINT", handleSigint);
        process.on("SIGTERM", handleSigterm);

        const originalResolve = resolve;
        resolve = ((result: ConcurrentRunResult) => {
            process.removeListener("SIGINT", handleSigint);
            process.removeListener("SIGTERM", handleSigterm);
            originalResolve(result);
        }) as typeof resolve;

        // Start spawning
        maybeSpawnMore();
    });
};
