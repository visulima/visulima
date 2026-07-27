/**
 * Polls a condition function until it returns true or times out.
 * Use instead of fixed `await delay(X)` to avoid CI flakiness.
 *
 * The ceiling sits just under the suite's 15s `testTimeout` on purpose. At the
 * old 2000ms every keyboard test in this package failed on windows-latest — the
 * keypress → reconciler → state round-trip for these widgets simply takes longer
 * than that on a loaded Windows runner, so all 4 configured attempts hit the same
 * wall and `retry` could never absorb it. Waiting longer costs nothing when the
 * condition is met (the poll resolves as soon as it is true) and still fails a
 * genuinely broken expectation, just later.
 * @param condition Function that returns true when the expected state is reached.
 * @param timeoutMs Maximum time to wait (default: 10000ms).
 * @param intervalMs Polling interval (default: 10ms).
 */
const waitFor = async (condition: () => boolean, timeoutMs = 10_000, intervalMs = 10): Promise<void> => {
    if (condition()) {
        return;
    }

    const start = Date.now();

    return new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
            try {
                if (condition()) {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - start >= timeoutMs) {
                    clearInterval(interval);
                    reject(new Error(`waitFor timed out after ${String(timeoutMs)}ms`));
                }
            } catch (error) {
                clearInterval(interval);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        }, intervalMs);
    });
};

export default waitFor;
