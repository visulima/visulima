/**
 * Error thrown by {@link toUint8Array} when the input cannot be converted to a
 * `Uint8Array`. Carries a stable, machine-readable `code` so callers can branch
 * on the failure programmatically instead of string-matching the message.
 */
class Uint8ArrayIncompatibleError extends Error {
    /**
     * Stable error code. Always `"UINT8ARRAY_INCOMPATIBLE"`.
     */
    public readonly code = "UINT8ARRAY_INCOMPATIBLE";

    public constructor(receivedType: string) {
        super(`UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array (received: ${receivedType})`);

        this.name = "Uint8ArrayIncompatibleError";

        // Restore the prototype chain for environments that down-level `extends Error`.
        Object.setPrototypeOf(this, Uint8ArrayIncompatibleError.prototype);
    }
}

/**
 * Options for {@link toUint8Array}.
 */
interface ToUint8ArrayOptions {
    /**
     * When `true`, always return a `Uint8Array` that owns a fresh copy of the
     * data, never a view sharing memory with the input. Useful to avoid the
     * Node Buffer-pool aliasing hazard. Defaults to `false`.
     */
    copy?: boolean;
}

/**
 * Re-checked per call (not cached) so the helpers stay correct if `Buffer` is
 * added/removed from the global scope at runtime (e.g. polyfills, test mocks),
 * while remaining usable in runtimes where it is simply absent (browser/edge).
 * @returns True if a Node-style `Buffer` global is available.
 */
const hasBuffer = (): boolean => typeof Buffer === "function";

// Shared, stateless coder instances — `TextEncoder`/`TextDecoder` are standard
// in every modern runtime (Node, Deno, browsers, edge) and cheap to reuse.
const textEncoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8");

const HEX_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

// Lookup table mapping a hex char code -> nibble value (or -1 if invalid).
const buildHexDecodeTable = (): Int8Array => {
    const table = new Int8Array(128).fill(-1);

    for (let index = 0; index < 10; index += 1) {
        table[48 + index] = index; // '0'-'9'
    }

    for (let index = 0; index < 6; index += 1) {
        table[97 + index] = 10 + index; // 'a'-'f'
        table[65 + index] = 10 + index; // 'A'-'F'
    }

    return table;
};

const HEX_DECODE_TABLE = buildHexDecodeTable();

/**
 * Converts a Node.js Buffer to a Uint8Array.
 *
 * Note: While Buffer instances are Uint8Array instances, this function creates a
 * new Uint8Array *view* on the Buffer's underlying ArrayBuffer, ensuring correct
 * byteOffset and length.
 *
 * Security note: this returns a view that shares memory with `buf`. For small
 * (< 4 KiB) Buffers created via `Buffer.from`/`Buffer.alloc`, Node uses a shared
 * pooled `ArrayBuffer`, so the returned view's `.buffer` may span unrelated
 * pooled data. Do not `transfer`, `structuredClone`, or otherwise expose
 * `result.buffer` to untrusted code; call {@link bufferToUint8Array} and then
 * `.slice()` (or use {@link toUint8Array} with `{ copy: true }`) if you need an
 * isolated, copied backing buffer.
 * @param buf The Buffer to convert.
 * @returns A Uint8Array view of the Buffer.
 */
const bufferToUint8Array = (buf: Buffer): Uint8Array => new Uint8Array(buf.buffer, buf.byteOffset, buf.length);

/**
 * Checks if a value is a `Uint8Array` (or, in Node.js, a `Buffer`).
 *
 * Uses a cross-realm-safe check (`Symbol.toStringTag`) so that `Uint8Array`s
 * originating from another realm (vm context, worker, iframe) are still
 * recognised, where a plain `instanceof` would return `false`.
 * @param x The value to check.
 * @returns True if x is a Uint8Array (or Buffer), false otherwise.
 */
const isUint8Array = (x: unknown): x is Uint8Array => {
    if (x instanceof Uint8Array) {
        return true;
    }

    // Cross-realm fallback: an object whose toStringTag is "Uint8Array" is a
    // Uint8Array from another realm (this also covers Buffer, which subclasses
    // Uint8Array in the same realm and is therefore already caught above).
    return typeof x === "object" && x !== null && Object.prototype.toString.call(x) === "[object Uint8Array]";
};

/**
 * Converts a latin1 string, array of strings, or template literal to a Uint8Array.
 *
 * Each character is mapped to a single byte via `charCodeAt(i) & 0xff`, i.e.
 * latin1 with wrap-around: code units above 0xFF keep only their low byte
 * (U+0141 `Ł` becomes `0x41` `A`). This is *not* strict ASCII (0–127) — for true
 * multi-byte text use {@link utf8ToUint8Array}.
 * @param txt The input string, array of strings, or template strings array.
 * @param subs Interpolated substitutions when used as a tagged template.
 * @returns A Uint8Array containing one byte per input code unit.
 */
const asciiToUint8Array = (txt: TemplateStringsArray | string | [string], ...subs: unknown[]): Uint8Array => {
    if (typeof txt === "string") {
        return asciiToUint8Array([txt]);
    }

    const input = "raw" in txt ? String.raw(txt, ...subs) : txt[0]; // Handle TemplateStringsArray (with interpolations) vs [string]

    // Fast path in Node: Buffer.from(input, "latin1") performs the same
    // low-byte mapping as the manual loop below, in native code. `new
    // Uint8Array(buffer)` copies the bytes into a fresh, plain (non-Buffer,
    // non-pooled) Uint8Array that owns its memory.
    if (hasBuffer()) {
        return new Uint8Array(Buffer.from(input, "latin1"));
    }

    const inputLength = input.length;
    const result = new Uint8Array(inputLength);

    for (let index = 0; index < inputLength; index += 1) {
        // eslint-disable-next-line unicorn/prefer-code-point, no-bitwise
        result[index] = input.charCodeAt(index) & 0xff; // keep low byte (latin1 wrap-around)
    }

    return result;
};

/**
 * Converts a UTF-8 string, array of strings, or template literal to a Uint8Array.
 *
 * Cross-runtime: uses the standard `TextEncoder`, so it works in browsers, Deno
 * and edge runtimes as well as Node. The returned `Uint8Array` owns its backing
 * `ArrayBuffer` (no shared Buffer pool exposure).
 * @param txt The input string, array of strings, or template strings array.
 * @param subs Interpolated substitutions when used as a tagged template.
 * @returns A Uint8Array representing the UTF-8 encoded string.
 */
const utf8ToUint8Array = (txt: TemplateStringsArray | [string] | string, ...subs: unknown[]): Uint8Array => {
    if (typeof txt === "string") {
        return utf8ToUint8Array([txt]);
    }

    const input = "raw" in txt ? String.raw(txt, ...subs) : txt[0]; // Handle TemplateStringsArray (with interpolations) vs [string]

    return textEncoder.encode(input);
};

/**
 * Decodes a `Uint8Array` (or `ArrayBuffer`) as a UTF-8 string.
 *
 * Cross-runtime via the standard `TextDecoder`. Invalid byte sequences are
 * replaced with U+FFFD (the WHATWG default).
 * @param data The bytes to decode.
 * @returns The decoded UTF-8 string.
 */
const uint8ArrayToUtf8 = (data: ArrayBuffer | Uint8Array): string => utf8Decoder.decode(data);

/**
 * Decodes a `Uint8Array` (or `ArrayBuffer`) as a latin1 string (one char per
 * byte). The inverse of {@link asciiToUint8Array}.
 * @param data The bytes to decode.
 * @returns The decoded latin1 string.
 */
const uint8ArrayToAscii = (data: ArrayBuffer | Uint8Array): string => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    let result = "";

    for (const byte of bytes) {
        // eslint-disable-next-line unicorn/prefer-code-point
        result += String.fromCharCode(byte);
    }

    return result;
};

/**
 * Encodes bytes as a lowercase hex string.
 * @param data The bytes to encode.
 * @returns The hex-encoded string (length is `2 * data.length`).
 */
const uint8ArrayToHex = (data: Uint8Array): string => {
    let result = "";

    for (const byte of data) {
        // Indices are always 0–15, so the lookups are guaranteed to be defined.
        // eslint-disable-next-line no-bitwise
        result += (HEX_CHARS[byte >> 4] as string) + (HEX_CHARS[byte & 0x0f] as string);
    }

    return result;
};

/**
 * Decodes a hex string into a `Uint8Array`. Accepts upper- or lower-case digits.
 * @param hex The hex string to decode. Must have an even length.
 * @returns The decoded bytes.
 * @throws {TypeError} If the string has an odd length or contains a non-hex character.
 */
const hexToUint8Array = (hex: string): Uint8Array => {
    if (hex.length % 2 !== 0) {
        throw new TypeError(`Invalid hex string: expected an even length, received ${String(hex.length)}`);
    }

    const result = new Uint8Array(hex.length / 2);

    for (let index = 0; index < result.length; index += 1) {
        // eslint-disable-next-line unicorn/prefer-code-point
        const high = HEX_DECODE_TABLE[hex.charCodeAt(index * 2)] ?? -1;
        // eslint-disable-next-line unicorn/prefer-code-point
        const low = HEX_DECODE_TABLE[hex.charCodeAt(index * 2 + 1)] ?? -1;

        if (high === -1 || low === -1) {
            throw new TypeError(`Invalid hex string: non-hex character at index ${String(index * 2)}`);
        }

        // eslint-disable-next-line no-bitwise
        result[index] = (high << 4) | low;
    }

    return result;
};

/**
 * Encodes bytes as a standard (RFC 4648) base64 string.
 * @param data The bytes to encode.
 * @returns The base64-encoded string.
 */
const uint8ArrayToBase64 = (data: Uint8Array): string => {
    if (hasBuffer()) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64");
    }

    let binary = "";

    for (const byte of data) {
        // eslint-disable-next-line unicorn/prefer-code-point
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
};

/**
 * Decodes a standard (RFC 4648) base64 string into a `Uint8Array`.
 * @param base64 The base64 string to decode.
 * @returns The decoded bytes.
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
    if (hasBuffer()) {
        // Copy into a plain Uint8Array that owns its (non-pooled) memory.
        return new Uint8Array(Buffer.from(base64, "base64"));
    }

    const binary = atob(base64);
    const result = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        // eslint-disable-next-line unicorn/prefer-code-point
        result[index] = binary.charCodeAt(index);
    }

    return result;
};

/**
 * Returns a `Uint8Array` for a `Buffer`/`Uint8Array`, copying when requested.
 * @param view The source view.
 * @param copy Whether to return an owned copy.
 * @returns The (possibly copied) Uint8Array.
 */
const maybeCopyView = (view: Uint8Array, copy: boolean): Uint8Array => {
    if (!copy) {
        return view;
    }

    // `.slice()` (not spread) preserves the Uint8Array type while copying into
    // an owned, non-aliased ArrayBuffer.
    // eslint-disable-next-line unicorn/prefer-spread
    return view.slice();
};

/**
 * Attempts to convert various data types to a `Uint8Array`.
 *
 * Supports `Uint8Array` (returned as-is, or copied with `{ copy: true }`),
 * `ArrayBuffer`, and arrays of numbers. In any runtime, strings are encoded as
 * UTF-8; in Node.js `Buffer` instances are also supported.
 * @param data The data to convert.
 * @param options Conversion options.
 * @returns A Uint8Array representation of the input data.
 * @throws {Uint8ArrayIncompatibleError} If the data cannot be converted.
 */
const toUint8Array = (data: unknown, options: ToUint8ArrayOptions = {}): Uint8Array => {
    const copy = options.copy === true;

    if (hasBuffer() && Buffer.isBuffer(data)) {
        return maybeCopyView(bufferToUint8Array(data), copy);
    }

    if (data instanceof Uint8Array) {
        return maybeCopyView(data, copy);
    }

    if (data instanceof ArrayBuffer) {
        // ArrayBuffer#slice clones the backing buffer (this is not Array#slice).
        // eslint-disable-next-line unicorn/prefer-spread
        return new Uint8Array(copy ? data.slice(0) : data);
    }

    if (Array.isArray(data)) {
        // Single pass: validate while filling, instead of an O(n) `.every()`
        // pre-pass followed by `new Uint8Array(data)` iterating again.
        const result = new Uint8Array(data.length);

        for (const [index, item] of data.entries()) {
            if (typeof item !== "number") {
                throw new Uint8ArrayIncompatibleError("Array containing non-number values");
            }

            result[index] = item;
        }

        return result;
    }

    if (typeof data === "string") {
        return utf8ToUint8Array(data);
    }

    throw new Uint8ArrayIncompatibleError(data === null ? "null" : typeof data);
};

export {
    asciiToUint8Array,
    base64ToUint8Array,
    bufferToUint8Array,
    hexToUint8Array,
    isUint8Array,
    toUint8Array,
    type ToUint8ArrayOptions,
    Uint8ArrayIncompatibleError,
    uint8ArrayToAscii,
    uint8ArrayToBase64,
    uint8ArrayToHex,
    uint8ArrayToUtf8,
    utf8ToUint8Array,
};

// eslint-disable-next-line import/no-extraneous-dependencies
export * from "@std/bytes";
