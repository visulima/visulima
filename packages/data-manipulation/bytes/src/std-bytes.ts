// Copyright 2018-2025 the Deno authors. MIT license.
// Ported from @std/bytes@1.0.6 (https://jsr.io/@std/bytes/1.0.6). Only the
// `Uint8Array` helpers are carried over; the JSR package itself is no longer a
// dependency.

/**
 * Concatenate multiple `Uint8Array`s into a single new `Uint8Array`.
 * @param buffers Arrays to concatenate, in order.
 * @returns A new array holding every byte of `buffers`.
 */
const concat = (buffers: ReadonlyArray<Uint8Array>): Uint8Array => {
    let length = 0;

    for (const buffer of buffers) {
        length += buffer.length;
    }

    const output = new Uint8Array(length);
    let index = 0;

    for (const buffer of buffers) {
        output.set(buffer, index);
        index += buffer.length;
    }

    return output;
};

/**
 * Copy bytes from `source` into `destination`, starting at `offset`. Copies as many bytes as fit.
 * @param source Source bytes.
 * @param destination Destination array, written in place.
 * @param offset Index in `destination` to start writing at. Clamped to `[0, destination.byteLength]`.
 * @returns The number of bytes copied.
 */
const copy = (source: Uint8Array, destination: Uint8Array, offset = 0): number => {
    const start = Math.max(0, Math.min(offset, destination.byteLength));
    const destinationBytesAvailable = destination.byteLength - start;
    const bytes = source.byteLength > destinationBytesAvailable ? source.subarray(0, destinationBytesAvailable) : source;

    destination.set(bytes, start);

    return bytes.byteLength;
};

const equalsNaive = (a: Uint8Array, b: Uint8Array): boolean => {
    for (const [index, byte] of b.entries()) {
        if (a[index] !== byte) {
            return false;
        }
    }

    return true;
};

const equals32Bit = (a: Uint8Array, b: Uint8Array): boolean => {
    const { length } = a;
    const compactOffset = 3 - ((a.byteOffset + 3) % 4);
    const compactLength = Math.floor((length - compactOffset) / 4);
    const compactA = new Uint32Array(a.buffer, a.byteOffset + compactOffset, compactLength);
    const compactB = new Uint32Array(b.buffer, b.byteOffset + compactOffset, compactLength);

    for (let i = 0; i < compactOffset; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    for (const [i, element] of compactA.entries()) {
        if (element !== compactB[i]) {
            return false;
        }
    }

    for (let i = compactOffset + compactLength * 4; i < length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
};

// Below this length the byte-wise loop is as fast as the 32-bit one.
const THRESHOLD_32_BIT = 160;

/**
 * Check whether two `Uint8Array`s hold the same bytes.
 * @param a First array.
 * @param b Second array.
 * @returns `true` when both have the same length and content.
 */
const equals = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    return a.length >= THRESHOLD_32_BIT && a.byteOffset % 4 === b.byteOffset % 4 ? equals32Bit(a, b) : equalsNaive(a, b);
};

/**
 * Repeat a byte sequence `count` times.
 * @param source Bytes to repeat.
 * @param count Non-negative integer repeat count.
 * @returns A new array of `source.length * count` bytes.
 * @throws {RangeError} When `count` is negative or not an integer.
 */
const repeat = (source: Uint8Array, count: number): Uint8Array => {
    if (count < 0 || !Number.isInteger(count)) {
        throw new RangeError("Count must be a non-negative integer");
    }

    const repeated = new Uint8Array(source.length * count);
    let offset = 0;

    while (offset < repeated.length) {
        offset += copy(source, repeated, offset);
    }

    return repeated;
};

/**
 * Check whether `source` ends with the bytes of `suffix`.
 * @param source Array to inspect.
 * @param suffix Bytes to look for at the end.
 * @returns `true` when `source` ends with `suffix`.
 */
const endsWith = (source: Uint8Array, suffix: Uint8Array): boolean => {
    const diff = source.length - suffix.length;

    if (diff < 0) {
        return false;
    }

    for (let i = suffix.length - 1; i >= 0; i -= 1) {
        if (source[diff + i] !== suffix[i]) {
            return false;
        }
    }

    return true;
};

/**
 * Check whether `source` starts with the bytes of `prefix`.
 * @param source Array to inspect.
 * @param prefix Bytes to look for at the start.
 * @returns `true` when `source` starts with `prefix`.
 */
const startsWith = (source: Uint8Array, prefix: Uint8Array): boolean => {
    if (prefix.length > source.length) {
        return false;
    }

    for (const [index, byte] of prefix.entries()) {
        if (source[index] !== byte) {
            return false;
        }
    }

    return true;
};

/**
 * Find the first occurrence of `needle` in `source`.
 * @param source Array to search.
 * @param needle Bytes to find.
 * @param start Index to start from. A negative value counts from the end.
 * @returns The index of the first match, or `-1`.
 */
const indexOfNeedle = (source: Uint8Array, needle: Uint8Array, start = 0): number => {
    const from = start < 0 ? Math.max(0, source.length + start) : start;

    if (needle.length > source.length - from) {
        return -1;
    }

    const s = needle[0];

    for (let i = from; i < source.length; i += 1) {
        if (source[i] !== s) {
            continue;
        }

        let matched = 1;
        let j = i + 1;

        while (matched < needle.length && source[j] === needle[j - i]) {
            matched += 1;
            j += 1;
        }

        if (matched === needle.length) {
            return i;
        }
    }

    return -1;
};

/**
 * Check whether `needle` occurs in `source`.
 * @param source Array to search.
 * @param needle Bytes to find.
 * @param start Index to start from. A negative value counts from the end.
 * @returns `true` when `needle` occurs at or after `start`.
 */
const includesNeedle = (source: Uint8Array, needle: Uint8Array, start = 0): boolean => indexOfNeedle(source, needle, start) !== -1;

/**
 * Find the last occurrence of `needle` in `source`.
 * @param source Array to search.
 * @param needle Bytes to find.
 * @param start Index to search backwards from. Defaults to the last index.
 * @returns The index where the last match starts, or `-1`.
 */
const lastIndexOfNeedle = (source: Uint8Array, needle: Uint8Array, start: number = source.length - 1): number => {
    if (start < 0) {
        return -1;
    }

    const from = start >= source.length ? source.length - 1 : start;
    const lastByte = needle[needle.length - 1];

    for (let i = from; i >= 0; i -= 1) {
        if (source[i] !== lastByte) {
            continue;
        }

        let matched = 1;
        let j = i;

        while (matched < needle.length) {
            j -= 1;

            if (source[j] !== needle[needle.length - 1 - (i - j)]) {
                break;
            }

            matched += 1;
        }

        if (matched === needle.length) {
            return i - needle.length + 1;
        }
    }

    return -1;
};

export {
    concat,
    copy,
    endsWith,
    equals,
    includesNeedle,
    indexOfNeedle,
    lastIndexOfNeedle,
    repeat,
    startsWith,
};
