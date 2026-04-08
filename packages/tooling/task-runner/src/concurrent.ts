/**
 * Public API for the concurrent process runner.
 *
 * Uses the native Rust addon when available, falling back to
 * a pure JavaScript implementation. Integrates flow controllers
 * (restart, teardown, timings) around the core runner.
 */

import { runConcurrentFallback } from "./concurrent-fallback";
import { detectScriptShell } from "./detect-shell";
import { logTimings } from "./flow-controllers/log-timings";
import { withRestart } from "./flow-controllers/restart-process";
import { runTeardown } from "./flow-controllers/teardown";
import { loadNativeBindings } from "./native-binding";
import type { ConcurrentCommandConfig, ConcurrentCommandInput, ConcurrentRunnerOptions, ConcurrentRunResult, ProcessEvent } from "./types";

/**
 * Normalize command inputs to ConcurrentCommandConfig objects.
 */
const normalizeCommands = (inputs: ConcurrentCommandInput[]): ConcurrentCommandConfig[] => inputs.map((input) => {
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

        return native.runConcurrentBatch(nativeCommands, nativeOptions);
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
