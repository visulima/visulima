/**
 * Wait for storage to be ready before handling requests.
 * This ensures storage initialization (e.g., AWS S3, GCS) completes before processing uploads.
 * @param storage Storage instance with isReady property and an optional lazy ensureReady check
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5000)
 * @throws Error if storage doesn't become ready within timeout, or the ensureReady check's own error
 */
export const waitForStorage = async (storage: { ensureReady?: () => Promise<void>; isReady: boolean }, timeoutMs = 5000): Promise<void> => {
    if (storage.isReady) {
        return;
    }

    // Storages with a lazy readiness check (e.g. S3) run it now; its failure is thrown as-is.
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

        return;
    }

    const startTime = Date.now();

    while (!storage.isReady && Date.now() - startTime < timeoutMs) {
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
