/**
 * Restart flow controller.
 *
 * Re-runs failed commands with configurable retry count and delay.
 * Supports fixed delay or exponential backoff.
 */

import type { ConcurrentCloseEvent, ConcurrentCommandConfig, ConcurrentRunResult, ConcurrentRunnerOptions, ProcessEvent } from "../types";

export interface RestartOptions {
    /** Maximum number of restart attempts per command. 0 = no restarts. -1 = infinite. */
    tries: number;
    /** Delay between restarts in milliseconds. "exponential" for 2^attempt * 1000ms. */
    delay: number | "exponential";
}

interface RestartState {
    attempts: number;
    commandIndex: number;
}

/**
 * Wraps a runner function to add restart-on-failure behavior.
 *
 * @param runFn - The underlying runner function (runConcurrently or runConcurrentFallback)
 * @param commands - The original command configs
 * @param options - Runner options
 * @param restartOptions - Restart-specific options
 */
export const withRestart = async (
    runFn: (commands: ConcurrentCommandConfig[], options: ConcurrentRunnerOptions) => Promise<ConcurrentRunResult>,
    commands: ConcurrentCommandConfig[],
    options: ConcurrentRunnerOptions,
    restartOptions: RestartOptions,
): Promise<ConcurrentRunResult> => {
    const { tries, delay } = restartOptions;

    if (tries === 0) {
        return runFn(commands, options);
    }

    const state: Map<number, RestartState> = new Map();
    const allCloseEvents: ConcurrentCloseEvent[] = [];
    const userOnEvent = options.onEvent;

    // Track which commands need restarting
    let pendingRestarts: ConcurrentCommandConfig[] = [...commands];
    let iteration = 0;

    while (pendingRestarts.length > 0) {
        const currentBatch = pendingRestarts;
        pendingRestarts = [];

        // eslint-disable-next-line no-await-in-loop -- sequential restart loop
        const result = await runFn(currentBatch, {
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
