import toBase64 from "./to-base64";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Returns the UTF-8 byte length of a string without allocating a Buffer when
 * one is unavailable.
 * @param value The string to measure.
 * @returns The number of UTF-8 octets the string encodes to.
 */
const utf8ByteLength = (value: string): number => {
    if (hasBuffer) {
        return Buffer.byteLength(value, "utf8");
    }

    return new TextEncoder().encode(value).length;
};

// Matches any character outside the 7-bit US-ASCII range.
// eslint-disable-next-line no-control-regex
const NON_ASCII_REGEX = /[^\u0000-\u007F]/;

/**
 * Determines whether a header value is pure US-ASCII (and therefore needs no
 * RFC 2047 encoding).
 * @param value The header value to inspect.
 * @returns True when every code unit is in the printable/whitespace ASCII range.
 */
const isAscii = (value: string): boolean => !NON_ASCII_REGEX.test(value);

/**
 * Encodes a header value as an RFC 2047 "B" encoded-word (base64) using UTF-8.
 *
 * Encoded-words are limited to 75 characters total per RFC 2047 §2, so long values are split into
 * multiple space-separated encoded-words. We split on UTF-8 byte boundaries (never inside a
 * multi-byte sequence) so each chunk decodes to valid text.
 * @param value The raw, possibly non-ASCII header value to encode.
 * @returns The RFC 2047 encoded representation, or the original value when it is already ASCII-only (callers still strip CR/LF separately).
 */
export const encodeMimeHeaderValue = (value: string): string => {
    if (isAscii(value)) {
        return value;
    }

    // Prefix `=?UTF-8?B?` (10) + suffix `?=` (2) = 12 overhead chars; the whole
    // encoded-word must stay <= 75 chars, leaving 63 base64 chars. base64
    // expands 3 octets to 4 chars, so cap each chunk at 45 source octets (=> 60
    // base64 chars) to stay safely under the limit.
    const maxBytesPerChunk = 45;
    const decoder = new TextDecoder();
    const bytes: Uint8Array = hasBuffer ? Buffer.from(value, "utf8") : new TextEncoder().encode(value);

    const words: string[] = [];
    let offset = 0;

    while (offset < bytes.length) {
        let end = Math.min(offset + maxBytesPerChunk, bytes.length);

        // Back off the boundary so we never split a multi-byte UTF-8 sequence:
        // continuation bytes match 0b10xxxxxx (0x80-0xBF).
        if (end < bytes.length) {
            // eslint-disable-next-line no-bitwise
            while (end > offset && ((bytes[end] as number) & 0xc0) === 0x80) {
                end -= 1;
            }
        }

        const chunk = bytes.subarray(offset, end);
        const chunkString = decoder.decode(chunk);

        words.push(`=?UTF-8?B?${toBase64(chunkString)}?=`);
        offset = end;
    }

    return words.join(" ");
};

export { utf8ByteLength };
