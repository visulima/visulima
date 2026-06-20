/**
 * Edge-safe cryptographic helpers backing the webhook signature verifiers.
 *
 * All primitives use the Web Crypto API (`globalThis.crypto.subtle`) and the
 * standard `TextEncoder` / `btoa` globals — no `node:crypto`, no `Buffer`. This keeps
 * the verifiers runnable on Cloudflare Workers, Deno and other edge runtimes.
 */

// `CryptoKey` / `SubtleCrypto` are flagged as experimental for the configured Node range
// but are stable on every edge runtime and in Node >= 20 `globalThis.crypto`. The
// node-builtins rule is disabled the same way `src/providers/utils/id.ts` does.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
type SubtleKey = CryptoKey;

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { subtle } = (globalThis as { crypto: { subtle: SubtleCrypto } }).crypto;

const encoder = new TextEncoder();

/**
 * Converts a byte array to a lowercase hex string.
 * @param bytes The bytes to encode.
 * @returns The hex-encoded string.
 */
const toHex = (bytes: Uint8Array): string => {
    let out = "";

    for (const byte of bytes) {
        out += byte.toString(16).padStart(2, "0");
    }

    return out;
};

/**
 * Converts a byte array to a standard base64 string without `node:Buffer`.
 * @param bytes The bytes to encode.
 * @returns The base64-encoded string.
 */
const toBase64 = (bytes: Uint8Array): string => {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

/**
 * Imports a UTF-8 secret as an HMAC key for the given hash.
 * @param secret The shared secret.
 * @param hash The hash algorithm (e.g. `"SHA-256"`).
 * @returns The imported key.
 */
const importHmacKey = async (secret: string, hash: string): Promise<SubtleKey> =>
    subtle.importKey("raw", encoder.encode(secret), { hash, name: "HMAC" }, false, ["sign"]);

/**
 * Computes an HMAC over `message` and returns the lowercase hex digest.
 * @param secret The shared secret.
 * @param message The message to sign.
 * @param hash The hash algorithm (e.g. `"SHA-256"`, `"SHA-1"`).
 * @returns The hex-encoded HMAC.
 */
export const hmacHex = async (secret: string, message: string, hash: string): Promise<string> => {
    const key = await importHmacKey(secret, hash);
    const signature = await subtle.sign("HMAC", key, encoder.encode(message));

    return toHex(new Uint8Array(signature));
};

/**
 * Computes an HMAC over `message` and returns the base64 digest.
 * @param secret The shared secret.
 * @param message The message to sign.
 * @param hash The hash algorithm (e.g. `"SHA-256"`, `"SHA-1"`).
 * @returns The base64-encoded HMAC.
 */
export const hmacBase64 = async (secret: string, message: string, hash: string): Promise<string> => {
    const key = await importHmacKey(secret, hash);
    const signature = await subtle.sign("HMAC", key, encoder.encode(message));

    return toBase64(new Uint8Array(signature));
};

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
