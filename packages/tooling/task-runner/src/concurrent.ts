/**
 * Public API for the concurrent process runner.
 *
 * Uses the native Rust addon when available, falling back to
 * a pure JavaScript implementation. Integrates flow controllers
 * (restart, teardown, timings) around the core runner.
 */

import { spawn } from "node:child_process";

import { runConcurrentFallback } from "./concurrent-fallback";
import { detectScriptShell } from "./detect-shell";
import { logTimings } from "./flow-controllers/log-timings";
import { withRestart } from "./flow-controllers/restart-process";
import { runTeardown } from "./flow-controllers/teardown";
import type { NativeProcessEvent } from "./native-binding";
import { loadNativeBindings } from "./native-binding";
import type { ConcurrentCommandConfig, ConcurrentCommandInput, ConcurrentRunnerOptions, ConcurrentRunResult } from "./types";

// ── Native-path signal cleanup ──────────────────────────────────────────
//
// The native runner already handles its own SIGINT/SIGTERM via tokio's
// signal::create_signal_handler(). But when the parent process is killed
// in a way that bypasses that loop — e.g. another listener calls
// process.exit() first, or the host TUI installs its own SIGINT handler —
// the tokio runtime is torn down before it can clean up its children,
// and the spawned processes leak.
//
// To close that gap we track every PID surfaced by the `started` event
// and install module-level fallbacks that fire signals directly through
// the kernel. process.kill is synchronous, so the children get the
// signal before the parent dies even if the rest of the listener chain
// short-circuits.

const trackedPids = new Set<number>();
let signalHandlersInstalled = false;

const killTrackedTree = (pid: number, signal: NodeJS.Signals): void => {
    try {
        if (process.platform === "win32") {
            // taskkill /T tears down the whole tree.
            spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
        } else {
            // Children are spawned in their own process group via setsid
            // (see native/src/concurrent/process_group.rs), so signalling
            // -pid hits the whole group in one syscall.
            process.kill(-pid, signal);
        }
    } catch {
        // Process may already be dead; nothing to do.
    }
};

const killAllTracked = (signal: NodeJS.Signals): void => {
    for (const pid of trackedPids) {
        killTrackedTree(pid, signal);
    }
};

const installSignalHandlersOnce = (): void => {
    if (signalHandlersInstalled) {
        return;
    }

    signalHandlersInstalled = true;

    // Bump the cap so a host that already attaches its own SIGINT/
    // SIGTERM/exit listeners (TUIs, test harnesses, other libraries)
    // doesn't trip Node's default 10-listener MaxListenersExceeded
    // warning when this module adds three more.
    process.setMaxListeners(process.getMaxListeners() + 3);

    process.on("SIGINT", () => {
        killAllTracked("SIGINT");
    });
    process.on("SIGTERM", () => {
        killAllTracked("SIGTERM");
    });
    // Synchronous safety net: fires even when another listener short-
    // circuits the chain by calling process.exit(). See concurrent-fallback.ts
    // for the same pattern on the JS path.
    process.on("exit", () => {
        killAllTracked("SIGTERM");
    });
};

/**
 * Normalize command inputs to ConcurrentCommandConfig objects.
 */
const normalizeCommands = (inputs: ConcurrentCommandInput[]): ConcurrentCommandConfig[] =>
    inputs.map((input) => {
        if (typeof input === "string") {
            return { command: input };
        }

        return input;
    });

/**
 * Core runner function that dispatches to native or JS fallback.
 * This is the inner runner without flow controller wrappers.
 */
const coreRun = async (configs: ConcurrentCommandConfig[], options: ConcurrentRunnerOptions): Promise<ConcurrentRunResult> => {
    // Resolve shell: explicit option > npm script-shell config > platform default
    const shellPath = options.shellPath ?? detectScriptShell();

    const native = loadNativeBindings();

    // Fall back to the JS runner when:
    // - any command needs stdin piping or PTY (native addon can't do those)
    // - onEvent streaming is requested (native addon's NAPI callback can emit
    //   null events on some platforms/CI, making it unreliable for streaming)
    const needsJsFallback = configs.some((c) => c.stdin === "pipe" || c.stdin === "pty") || !!options.onEvent;

    if (native && !needsJsFallback) {
        const nativeOptions = {
            killOthers: options.killOthers,
            killSignal: options.killSignal,
            killTimeout: options.killTimeout,
            maxProcesses: options.maxProcesses,
            shellPath,
            successCondition: options.successCondition,
        };

        const nativeCommands = configs.map((c) => {
            return {
                command: c.command,
                cwd: c.cwd,
                env: c.env,
                name: c.name,
                shell: c.shell,
                stdin: c.stdin,
            };
        });

        installSignalHandlersOnce();

        // PIDs from *this* run keyed by command index. We untrack
        // on close/error so an exited child's pid can't be hit by a
        // later signal (the kernel may recycle it for an unrelated
        // process). Anything still in this map at run-resolution time
        // gets cleaned up by the finally block.
        const indexToPid = new Map<number, number>();

        const onLifecycle = (event: NativeProcessEvent | null | undefined): void => {
            // NAPI threadsafe-function callbacks have been observed to
            // deliver null events on some platforms/CI — guard or the
            // process crashes with TypeError.
            if (event == null) {
                return;
            }

            if (event.kind === "started" && typeof event.pid === "number") {
                trackedPids.add(event.pid);
                indexToPid.set(event.index, event.pid);

                return;
            }

            if (event.kind === "close" || event.kind === "error") {
                const pid = indexToPid.get(event.index);

                if (pid !== undefined) {
                    trackedPids.delete(pid);
                    indexToPid.delete(event.index);
                }
            }
        };

        try {
            return await native.runConcurrentBatch(nativeCommands, nativeOptions, onLifecycle);
        } finally {
            for (const pid of indexToPid.values()) {
                trackedPids.delete(pid);
            }
        }
    }

    return runConcurrentFallback(configs, { ...options, shellPath });
};

/**
 * Run commands concurrently with output streaming and process management.
 *
 * Automatically uses the native Rust addon for performance when available,
 * falling back to a pure JavaScript implementation.
 *
 * Supports flow controllers:
 * - `restart`: retry failed commands with configurable delay/backoff
 * - `teardown`: run cleanup commands after all processes complete
 * - `timings`: print a timing summary table
 * @param commands Array of command strings or config objects
 * @param options Runner options (maxProcesses, killOthers, restart, teardown, etc.)
 * @returns Promise resolving to the run result with close events and success status
 */
export const runConcurrently = async (commands: ConcurrentCommandInput[], options: ConcurrentRunnerOptions = {}): Promise<ConcurrentRunResult> => {
    const configs = normalizeCommands(commands);

    if (configs.length === 0) {
        return { closeEvents: [], success: true };
    }

    // Run with or without restart wrapper
    let result: ConcurrentRunResult;

    if (options.restart && options.restart.tries !== 0) {
        result = await withRestart((cmds, options_) => coreRun(cmds, options_), configs, options, {
            delay: options.restart.delay ?? 0,
            tries: options.restart.tries,
        });
    } else {
        result = await coreRun(configs, options);
    }

    // Print timing summary if requested
    if (options.timings) {
        logTimings(result.closeEvents);
    }

    // Run teardown commands if provided
    if (options.teardown && options.teardown.length > 0) {
        await runTeardown({
            commands: options.teardown,
            cwd: options.teardownCwd,
        });
    }

    return result;
};
