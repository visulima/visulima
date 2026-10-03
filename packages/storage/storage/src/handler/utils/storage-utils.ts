/**
 * Wait for storage to be ready before handling requests.
 * This ensures storage initialization (e.g., AWS S3, GCS) completes before processing uploads.
 * @param storage Storage instance with isReady property and an optional ensureReady access check
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5000)
 * @throws Error if storage doesn't become ready within timeout, or the ensureReady check's own error
 */
export const waitForStorage = async (storage: { ensureReady?: () => Promise<void>; isReady: boolean }, timeoutMs = 5000): Promise<void> => {
    if (storage.isReady) {
        return;
    }

    // One budget for the access check and the polling after it.
    const deadline = Date.now() + timeoutMs;

    // Run (or retry) the storage's access check now; its failure is thrown as-is. A storage
    // without one is polled until it reports ready.
    if (typeof storage.ensureReady === "function") {
        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            await Promise.race([
                storage.ensureReady(),
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error("Storage initialization timeout"));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }

        if (storage.isReady) {
            return;
        }
    }

    while (!storage.isReady && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 100);
        });
    }

    if (!storage.isReady) {
        throw new Error("Storage initialization timeout");
    }
};
