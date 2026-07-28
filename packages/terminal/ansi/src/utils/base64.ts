/**
 * Encodes a `Uint8Array` to a Base64 string in a runtime-agnostic way.
 *
 * Prefers the standardized `Uint8Array.prototype.toBase64` (Node ≥ 24, modern
 * browsers). Falls back to `btoa` (browsers/Deno) and finally to Node's
 * `Buffer`, so callers stay usable in xterm.js / browser bundles without
 * pulling in `node:buffer`.
 * @param data The bytes to encode.
 * @returns The Base64 representation of `data`.
 */
export const encodeBase64Bytes = (data: Uint8Array): string => {
    const maybeToBase64 = (data as unknown as { toBase64?: () => string }).toBase64;

    if (typeof maybeToBase64 === "function") {
        return maybeToBase64.call(data);
    }

    if (typeof btoa === "function") {
        let binary = "";

        for (const byte of data) {
            binary += String.fromCodePoint(byte);
        }

        return btoa(binary);
    }

    // Node.js fallback for runtimes without `toBase64`/`btoa`.
    const nodeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;

    if (nodeBuffer === undefined) {
        throw new Error("No Base64 encoder available: Uint8Array.prototype.toBase64, btoa and Buffer are all missing.");
    }

    return nodeBuffer.from(data).toString("base64");
};

/**
 * Encodes a UTF-8 string to Base64 in a runtime-agnostic way.
 * @param value The UTF-8 string to encode.
 * @returns The Base64 representation of `value`.
 */
export const encodeBase64String = (value: string): string => encodeBase64Bytes(new TextEncoder().encode(value));
