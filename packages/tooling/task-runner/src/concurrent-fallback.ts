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

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";

import type { IPty } from "@lydell/node-pty";
import { spawn as ptySpawn } from "@lydell/node-pty";

import type { ConcurrentCloseEvent, ConcurrentCommandConfig, ConcurrentRunnerOptions, ConcurrentRunResult, ProcessEvent } from "./types";

interface ActiveProcess {
    child?: ChildProcess;
    index: number;
    pty?: IPty;
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

    // Emit "started" event with write/kill functions for stdin access
    onEvent({
        index,
        kill: child.pid
            ? (signal?: string) => {
                killTree(child.pid!, signal ?? "SIGTERM");
            }
            : undefined,
        kind: "started",
        write: child.stdin ? (data: string) => child.stdin!.write(data) : undefined,
    });

    // Stream stdout line by line, with flush timer for partial lines
    let stdoutBuffer = "";
    let stdoutFlushTimer: ReturnType<typeof setTimeout> | undefined;

    const flushStdoutBuffer = (): void => {
        if (stdoutBuffer) {
            onEvent({ index, kind: "stdout", text: stdoutBuffer });
            stdoutBuffer = "";
        }
    };

    child.stdout?.on("data", (data: Buffer) => {
        if (stdoutFlushTimer) {
            clearTimeout(stdoutFlushTimer);
            stdoutFlushTimer = undefined;
        }

        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");

        stdoutBuffer = lines.pop() ?? "";

        for (const line of lines) {
            onEvent({ index, kind: "stdout", text: line });
        }

        if (stdoutBuffer) {
            stdoutFlushTimer = setTimeout(flushStdoutBuffer, 100);
        }
    });

    child.stdout?.on("end", () => {
        if (stdoutFlushTimer) {
            clearTimeout(stdoutFlushTimer);
            stdoutFlushTimer = undefined;
        }

        flushStdoutBuffer();
    });

    // Stream stderr line by line, with partial-line flush
    let stderrBuffer = "";
    let stderrFlushTimer: ReturnType<typeof setTimeout> | undefined;

    const flushStderrBuffer = (): void => {
        if (stderrBuffer) {
            onEvent({ index, kind: "stderr", text: stderrBuffer });
            stderrBuffer = "";
        }
    };

    child.stderr?.on("data", (data: Buffer) => {
        if (stderrFlushTimer) {
            clearTimeout(stderrFlushTimer);
            stderrFlushTimer = undefined;
        }

        stderrBuffer += data.toString();
        const lines = stderrBuffer.split("\n");

        stderrBuffer = lines.pop() ?? "";

        for (const line of lines) {
            onEvent({ index, kind: "stderr", text: line });
        }

        if (stderrBuffer) {
            stderrFlushTimer = setTimeout(flushStderrBuffer, 100);
        }
    });

    child.stderr?.on("end", () => {
        if (stderrFlushTimer) {
            clearTimeout(stderrFlushTimer);
            stderrFlushTimer = undefined;
        }

        flushStderrBuffer();
    });

    child.on("error", (error: Error) => {
        onEvent({ index, kind: "error", message: error.message });
    });

    child.on("close", (code, signal) => {
        if (stdoutFlushTimer) {
            clearTimeout(stdoutFlushTimer);
            stdoutFlushTimer = undefined;
        }

        if (stderrFlushTimer) {
            clearTimeout(stderrFlushTimer);
            stderrFlushTimer = undefined;
        }

        flushStdoutBuffer();
        flushStderrBuffer();

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
 * Spawn a command inside a pseudo-terminal (PTY) so the child sees isatty() === true.
 * Falls back to pipe mode if @lydell/node-pty is not available.
 */
const spawnCommandPty = (
    index: number,
    config: ConcurrentCommandConfig,
    shellPath: string | undefined,
    onEvent: (event: ProcessEvent) => void,
    onComplete: (closeEvent: ConcurrentCloseEvent) => void,
): ActiveProcess => {
    const startTime = process.hrtime();

    let shellProgram: string;
    let shellArgs: string[];

    if (shellPath) {
        shellProgram = shellPath;
        shellArgs = ["-c", config.command];
    } else if (process.platform === "win32") {
        shellProgram = "cmd.exe";
        shellArgs = ["/s", "/c", config.command];
    } else {
        shellProgram = "/bin/sh";
        shellArgs = ["-c", config.command];
    }

    const ptyInstance = ptySpawn(shellProgram, shellArgs, {
        cols: config.ptySize?.cols ?? 80,
        cwd: config.cwd ?? process.cwd(),
        env: Object.fromEntries(
            Object.entries({ ...process.env, ...config.env, FORCE_COLOR: process.env["FORCE_COLOR"] ?? "1", TERM: "xterm-256color" }).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
        ),
        name: "xterm-256color",
        rows: config.ptySize?.rows ?? 24,
    });

    onEvent({
        index,
        kill: (signal?: string) => {
            ptyInstance.kill(signal);
        },
        kind: "started",
        resize: (cols: number, rows: number) => {
            ptyInstance.resize(cols, rows);
        },
        write: (data: string) => {
            ptyInstance.write(data);
        },
    });

    // PTY merges stdout/stderr into one stream. Emit raw data chunks
    // so the consumer can process ANSI sequences through a TerminalBuffer.
    ptyInstance.onData((data: string) => {
        onEvent({ index, kind: "stdout", text: data });
    });

    ptyInstance.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        const elapsed = process.hrtime(startTime);
        const durationMs = elapsed[0] * 1000 + elapsed[1] / 1_000_000;
        const code = exitCode ?? (signal ? 1 : -1);

        const closeEvent: ConcurrentCloseEvent = {
            command: config.command,
            durationMs,
            exitCode: code,
            index,
            killed: signal !== undefined && signal !== 0,
            name: config.name,
        };

        onEvent({
            commandName: config.name,
            durationMs,
            exitCode: code,
            index,
            killed: signal !== undefined && signal !== 0,
            kind: "close",
        });

        onComplete(closeEvent);
    });

    return { index, pty: ptyInstance, startTime };
};

/**
 * Run commands concurrently using pure JavaScript (child_process.spawn).
 * This is the fallback when the native Rust addon is unavailable.
 */
export const runConcurrentFallback = (commands: ConcurrentCommandConfig[], options: ConcurrentRunnerOptions): Promise<ConcurrentRunResult> =>
    new Promise((resolve) => {
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
                if (proc.pty) {
                    proc.pty.kill(killSignal);
                } else if (proc.child?.pid) {
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

        const handleClose = (cmdIndex: number, closeEvent: ConcurrentCloseEvent): void => {
            const activeIndex = active.findIndex((p) => p.index === cmdIndex);

            if (activeIndex !== -1) {
                active.splice(activeIndex, 1);
            }

            if (aborting) {
                closeEvent.killed = true;

                if (sigintAbort) {
                    closeEvent.exitCode = 0;
                }
            }

            closeEvents.push(closeEvent);

            if (!aborting && shouldKillOthers(closeEvent)) {
                aborting = true;
                killAll();
            }

            if (!aborting) {
                maybeSpawnMore();
            }

            if (active.length === 0 && pending.length === 0) {
                const success = evaluateSuccess(closeEvents, successCondition);

                resolve({ closeEvents, success });
            }
        };

        const maybeSpawnMore = (): void => {
            while (active.length < maxProcesses && pending.length > 0) {
                const cmdIndex = pending.shift()!;
                const config = commands[cmdIndex]!;

                const proc
                    = config.stdin === "pty"
                        ? spawnCommandPty(cmdIndex, config, options.shellPath, onEvent, (ce) => {
                            handleClose(cmdIndex, ce);
                        })
                        : spawnCommand(cmdIndex, config, options.shellPath, onEvent, (ce) => {
                            handleClose(cmdIndex, ce);
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
