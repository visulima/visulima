export interface WaitForOptions {
    /**
     * Polling interval in milliseconds.
     * @default 50
     */
    interval?: number;

    /**
     * Maximum time to wait in milliseconds before throwing.
     * @default 3000
     */
    timeout?: number;
}

/**
 * Wait for a condition to be met by polling at a regular interval.
 *
 * If `condition` is a string, waits until `screenText()` contains it.
 * If `condition` is a function, waits until it stops throwing.
 *
 * @throws The last error encountered if the timeout is reached.
 */
export const waitFor = async (
    condition: (() => void) | string,
    screenText: () => string,
    options: WaitForOptions = {},
): Promise<void> => {
    const timeout = options.timeout ?? 3000;
    const interval = options.interval ?? 50;
    const start = Date.now();
    let lastError: Error | undefined;

    const check = (): void => {
        if (typeof condition === "string") {
            const current = screenText();

            if (!current.includes(condition)) {
                throw new Error(`Timed out waiting for text: "${condition}"\n\nScreen content:\n${current}`);
            }
        } else {
            condition();
        }
    };

    while (Date.now() - start < timeout) {
        try {
            check();

            return;
        } catch (error) {
            lastError = error as Error;
        }

        await new Promise<void>((resolve) => {
            setTimeout(resolve, interval);
        });
    }

    // Final attempt
    try {
        check();

        return;
    } catch (error) {
        lastError = error as Error;
    }

    throw lastError ?? new Error("waitFor timed out");
};
