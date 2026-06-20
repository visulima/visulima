/**
 * Shared edge-safe Web Crypto helpers used by signing providers (AWS SigV4, VAPID,
 * RFC 8291 push encryption). Every primitive here relies only on `globalThis.crypto`,
 * `TextEncoder`, `btoa`/`atob` and `Uint8Array` — no `node:crypto`, no `Buffer`.
 */

/**
 * A `Uint8Array` explicitly backed by a (non-shared) `ArrayBuffer`. Web Crypto's
 * `BufferSource` parameters reject `SharedArrayBuffer`-backed views, so the helpers
 * here standardise on this narrower type to satisfy the DOM lib typings.
 */
type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Allocates a zero-filled `Bytes` buffer of the requested length.
 * @param length The buffer length in bytes.
 * @returns A new `ArrayBuffer`-backed `Uint8Array`.
 */
const alloc = (length: number): Bytes => new Uint8Array(new ArrayBuffer(length));

/**
 * Normalises any `Uint8Array` into an `ArrayBuffer`-backed {@link Bytes} view, copying when
 * the source is backed by a `SharedArrayBuffer` (which Web Crypto's `BufferSource` rejects).
 * @param source The input bytes.
 * @returns An `ArrayBuffer`-backed view over the same byte values.
 */
const toBytes = (source: Uint8Array): Bytes => {
    if (source.buffer instanceof ArrayBuffer) {
        return source as Bytes;
    }

    const copy = alloc(source.length);

    copy.set(source);

    return copy;
};

/**
 * Returns the Web Crypto `SubtleCrypto` accessor from the global scope.
 * @returns The `globalThis.crypto.subtle` instance.
 */
// eslint-disable-next-line n/no-unsupported-features/node-builtins
export const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

export type { Bytes };

/**
 * Returns `n` cryptographically-random bytes via the Web Crypto global.
 * @param length Number of random bytes to produce.
 * @returns A `Uint8Array` of the requested length filled with random bytes.
 */
export const randomBytes = (length: number): Bytes => {
    const bytes = alloc(length);

    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    globalThis.crypto.getRandomValues(bytes);

    return bytes;
};

/**
 * Encodes a UTF-8 string into bytes.
 * @param value The string to encode.
 * @returns The UTF-8 byte representation.
 */
export const utf8 = (value: string): Bytes => {
    const encoded = new TextEncoder().encode(value);
    const bytes = alloc(encoded.length);

    bytes.set(encoded);

    return bytes;
};

/**
 * Concatenates byte chunks into a single `Uint8Array`.
 * @param chunks The byte arrays to join in order.
 * @returns A new array containing every chunk back-to-back.
 */
export const concatBytes = (...chunks: Uint8Array[]): Bytes => {
    let total = 0;

    for (const chunk of chunks) {
        total += chunk.length;
    }

    const out = alloc(total);
    let offset = 0;

    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }

    return out;
};

/**
 * Lowercase hex encoding of a byte array (used by SigV4 signatures and hashes).
 * @param bytes The bytes to encode.
 * @returns The hex string.
 */
export const toHex = (bytes: Uint8Array): string => {
    let hex = "";

    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, "0");
    }

    return hex;
};

/**
 * Standard base64 encoding of a byte array via `btoa` (edge-safe, no `Buffer`).
 * @param bytes The bytes to encode.
 * @returns The base64 string.
 */
export const toBase64 = (bytes: Uint8Array): string => {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

/**
 * URL-safe base64 (RFC 4648 §5) without padding — the encoding VAPID/JWT/RFC 8291 use.
 * @param bytes The bytes to encode.
 * @returns The base64url string.
 */
export const toBase64Url = (bytes: Uint8Array): string => {
    let encoded = toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_");

    while (encoded.endsWith("=")) {
        encoded = encoded.slice(0, -1);
    }

    return encoded;
};

/**
 * Decodes a base64url (or padded base64) string back into bytes.
 * @param value The base64url string.
 * @returns The decoded bytes.
 */
export const fromBase64Url = (value: string): Bytes => {
    const normalised = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalised.padEnd(normalised.length + ((4 - (normalised.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = alloc(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.codePointAt(index) ?? 0;
    }

    return bytes;
};

/**
 * Big-endian byte encoding of an unsigned integer.
 * @param value The non-negative integer to encode.
 * @param length The fixed output width in bytes.
 * @returns A big-endian byte array of the given width.
 */
export const uintToBytes = (value: number, length: number): Bytes => {
    const bytes = alloc(length);

    let remaining = value;

    for (let index = length - 1; index >= 0; index -= 1) {
        bytes[index] = remaining % 256;
        remaining = Math.floor(remaining / 256);
    }

    return bytes;
};

/**
 * Computes a SHA-256 digest.
 * @param data The bytes to hash.
 * @returns The 32-byte digest.
 */
export const sha256 = async (data: Bytes): Promise<Bytes> => {
    const digest = await subtle().digest("SHA-256", data);

    return new Uint8Array(digest);
};

/**
 * Computes an HMAC-SHA256 over `data` with `key`.
 * @param key The raw HMAC key bytes.
 * @param data The message bytes.
 * @returns The 32-byte MAC.
 */
export const hmacSha256 = async (key: Bytes, data: Bytes): Promise<Bytes> => {
    const cryptoKey = await subtle().importKey("raw", key, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
    const signature = await subtle().sign("HMAC", cryptoKey, data);

    return new Uint8Array(signature);
};

/**
 * Computes an HMAC over `message` with `key` for the given hash algorithm.
 *
 * Accepts either a string key (imported as UTF-8 bytes) or raw key bytes, and either a
 * string message (UTF-8 encoded) or raw bytes — covering both the text-secret webhook
 * verifiers and the byte-keyed Standard Webhooks scheme.
 * @param key The HMAC key, as a UTF-8 string or raw bytes.
 * @param message The message to sign, as a UTF-8 string or raw bytes.
 * @param hash The hash algorithm (`"SHA-1"` or `"SHA-256"`).
 * @returns The raw MAC bytes.
 */
export const hmac = async (key: string | Uint8Array, message: string | Uint8Array, hash: "SHA-1" | "SHA-256"): Promise<Bytes> => {
    const keyBytes = typeof key === "string" ? utf8(key) : toBytes(key);
    const messageBytes = typeof message === "string" ? utf8(message) : toBytes(message);
    const cryptoKey = await subtle().importKey("raw", keyBytes, { hash, name: "HMAC" }, false, ["sign"]);
    const signature = await subtle().sign("HMAC", cryptoKey, messageBytes);

    return new Uint8Array(signature);
};

/**
 * HKDF (RFC 5869) with SHA-256, returning `length` bytes of output keying material.
 * Used by RFC 8291 web-push payload encryption.
 * @param salt The non-secret randomiser mixed into the extract step.
 * @param ikm The input keying material.
 * @param info The context/application-specific info string bytes.
 * @param length The number of output bytes requested.
 * @returns The derived key material.
 */
export const hkdfSha256 = async (salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> => {
    const baseKey = await subtle().importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    const bits = await subtle().deriveBits({ hash: "SHA-256", info, name: "HKDF", salt }, baseKey, length * 8);

    return new Uint8Array(bits);
};
