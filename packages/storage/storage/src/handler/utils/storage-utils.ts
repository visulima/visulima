/**
 * Wait for storage to be ready before handling requests.
 * This ensures storage initialization (e.g., AWS S3, GCS) completes before processing uploads.
 * @param storage Storage instance with isReady property
 * @param timeoutMs Maximum time to wait in milliseconds (default: 5000)
 * @throws Error if storage doesn't become ready within timeout
 */
export const waitForStorage = async (storage: { isReady: boolean }, timeoutMs = 5000): Promise<void> => {
    if (storage.isReady) {
        return;
    }

    const startTime = Date.now();

    while (!storage.isReady && Date.now() - startTime < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
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
