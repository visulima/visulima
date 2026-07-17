/**
 * Polls a condition function until it returns true or times out.
 * Use instead of fixed `await delay(X)` to avoid CI flakiness.
 * @param condition Function that returns true when the expected state is reached.
 * @param timeoutMs Maximum time to wait (default: 2000ms).
 * @param intervalMs Polling interval (default: 10ms).
 */
const waitFor = async (condition: () => boolean, timeoutMs = 2000, intervalMs = 10): Promise<void> => {
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
