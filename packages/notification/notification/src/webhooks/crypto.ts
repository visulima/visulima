/**
 * Edge-safe cryptographic helpers backing the webhook signature verifiers.
 *
 * These are thin wrappers over the shared {@link ../providers/utils/webcrypto Web Crypto}
 * layer (`globalThis.crypto.subtle`, `TextEncoder`, `btoa`) — no `node:crypto`, no
 * `Buffer` — so the verifiers stay runnable on Cloudflare Workers, Deno and other edge
 * runtimes.
 */

import { hmac, toBase64, toHex } from "../providers/utils/webcrypto";

/**
 * Default replay window in seconds (5 minutes). Signed timestamps outside this window
 * are rejected by the Slack and Standard Webhooks verifiers.
 */
export const REPLAY_WINDOW_SECONDS: number = 60 * 5;

/**
 * Computes an HMAC over `message` and returns the lowercase hex digest.
 * @param key The shared secret (UTF-8 string) or raw key bytes.
 * @param message The message to sign.
 * @param hash The hash algorithm (`"SHA-1"` or `"SHA-256"`).
 * @returns The hex-encoded HMAC.
 */
export const hmacHex = async (key: string | Uint8Array, message: string, hash: "SHA-1" | "SHA-256"): Promise<string> => toHex(await hmac(key, message, hash));

/**
 * Computes an HMAC over `message` and returns the base64 digest.
 * @param key The shared secret (UTF-8 string) or raw key bytes.
 * @param message The message to sign.
 * @param hash The hash algorithm (`"SHA-1"` or `"SHA-256"`).
 * @returns The base64-encoded HMAC.
 */
export const hmacBase64 = async (key: string | Uint8Array, message: string, hash: "SHA-1" | "SHA-256"): Promise<string> =>
    toBase64(await hmac(key, message, hash));

/**
 * Constant-time string comparison to avoid leaking match position via timing.
 *
 * Both inputs are compared in full; the function returns early only on length
 * mismatch (which is not secret).
 * @param a The first string.
 * @param b The second string.
 * @returns `true` when the strings are equal.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    let mismatch = 0;

    for (let index = 0; index < a.length; index += 1) {
        // eslint-disable-next-line no-bitwise
        mismatch |= (a.codePointAt(index) ?? 0) ^ (b.codePointAt(index) ?? 0);
    }

    return mismatch === 0;
};

/**
 * Checks a signed Unix-seconds timestamp header against a replay window.
 * @param timestampHeader The raw timestamp header value (Unix seconds), or `undefined`.
 * @param windowSeconds The maximum allowed clock skew in seconds.
 * @returns `true` when the timestamp is present, numeric and within the window.
 */
export const isWithinReplayWindow = (timestampHeader: string | undefined, windowSeconds: number): boolean => {
    if (timestampHeader === undefined) {
        return false;
    }

    const timestampSeconds = Number.parseInt(timestampHeader, 10);

    if (Number.isNaN(timestampSeconds)) {
        return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    return Math.abs(nowSeconds - timestampSeconds) <= windowSeconds;
};
