let counter = 0;

/**
 * Generates a best-effort unique message id for providers whose API does not return
 * one. Edge-safe — does not rely on `node:crypto` (uses a monotonic counter + the
 * `crypto.randomUUID` global when available).
 * @param prefix A short provider prefix.
 * @returns A unique-ish message id.
 */
const generateMessageId = (prefix: string): string => {
    counter += 1;

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

    if (globalCrypto?.randomUUID) {
        return `${prefix}-${globalCrypto.randomUUID()}`;
    }

    // eslint-disable-next-line sonarjs/pseudo-random
    return `${prefix}-${String(counter)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
};

export default generateMessageId;
