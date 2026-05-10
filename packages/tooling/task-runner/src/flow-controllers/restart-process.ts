/**
 * Restart flow controller.
 *
 * Re-runs failed commands with configurable retry count and delay.
 * Supports fixed delay or exponential backoff.
 */

import type { ConcurrentCloseEvent, ConcurrentCommandConfig, ConcurrentRunnerOptions, ConcurrentRunResult, ProcessEvent } from "../types";

export interface RestartOptions {
    /** Delay between restarts in milliseconds. "exponential" for 2^attempt * 1000ms. */
    delay: number | "exponential";
    /**
     * Optional pre-restart callback. Fires once per scheduled retry,
     * **after** the failed attempt is detected and **before** the restart
     * delay sleeps — giving callers a chance to log, emit metrics, or
     * abort the retry by throwing.
     *
     * `attempt` is 1-indexed and counts the retry that's about to start
     * (the original failed run was attempt 0). `commandIndex` matches
     * the position of the failing command in the input array.
     *
     * Throwing aborts the entire `withRestart` batch — the rejection
     * surfaces from `runConcurrently` to the caller, mirroring the
     * existing error path. Use this to gate retries on external state
     * (budget exhaustion, circuit breakers).
     */
    onRetry?: (attempt: number, commandIndex: number, prevExitCode: number) => Promise<void> | void;
    /** Maximum number of restart attempts per command. 0 = no restarts. -1 = infinite. */
    tries: number;
}

interface RestartState {
    attempts: number;
    commandIndex: number;
}

/**
 * Wraps a runner function to add restart-on-failure behavior.
 * @param runFn The underlying runner function (runConcurrently or runConcurrentFallback)
 * @param commands The original command configs
 * @param options Runner options
 * @param restartOptions Restart-specific options
 */
export const withRestart = async (
    runFunction: (commands: ConcurrentCommandConfig[], options: ConcurrentRunnerOptions) => Promise<ConcurrentRunResult>,
    commands: ConcurrentCommandConfig[],
    options: ConcurrentRunnerOptions,
    restartOptions: RestartOptions,
): Promise<ConcurrentRunResult> => {
    const { delay, onRetry, tries } = restartOptions;

    if (tries === 0) {
        return runFunction(commands, options);
    }

    const state = new Map<number, RestartState>();
    const allCloseEvents: ConcurrentCloseEvent[] = [];
    const userOnEvent = options.onEvent;

    // Track which commands need restarting
    let pendingRestarts: ConcurrentCommandConfig[] = [...commands];
    let iteration = 0;

    while (pendingRestarts.length > 0) {
        const currentBatch = pendingRestarts;

        pendingRestarts = [];

        // eslint-disable-next-line no-await-in-loop -- sequential restart loop
        const result = await runFunction(currentBatch, {
            ...options,
            onEvent: (event: ProcessEvent) => {
                userOnEvent?.(event);
            },
        });

        for (const closeEvent of result.closeEvents) {
            if (closeEvent.exitCode !== 0) {
                const cmdState = state.get(closeEvent.index) ?? { attempts: 0, commandIndex: closeEvent.index };

                cmdState.attempts++;
                state.set(closeEvent.index, cmdState);

                const shouldRestart = tries === -1 || cmdState.attempts <= tries;

                if (shouldRestart) {
                    if (onRetry) {
                        // Fire before the delay so subscribers can mutate
                        // external state (budget, breakers) and abort by
                        // throwing — saving us a sleep we'd never use.
                        // eslint-disable-next-line no-await-in-loop -- intentional sequential ordering with delay below
                        await onRetry(cmdState.attempts, closeEvent.index, closeEvent.exitCode ?? 1);
                    }

                    const delayMs = delay === "exponential" ? Math.min(2 ** (cmdState.attempts - 1) * 1000, 30_000) : delay;

                    if (delayMs > 0) {
                        // eslint-disable-next-line no-await-in-loop -- intentional delay
                        await sleep(delayMs);
                    }

                    pendingRestarts.push(currentBatch[closeEvent.index]!);
                    continue;
                }
            }

            allCloseEvents.push(closeEvent);
        }

        iteration++;

        // Safety: prevent infinite loops if tries is -1 but commands keep failing
        if (iteration > 1000) {
            break;
        }
    }

    const success = allCloseEvents.every((e) => e.exitCode === 0);

    return { closeEvents: allCloseEvents, success };
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
