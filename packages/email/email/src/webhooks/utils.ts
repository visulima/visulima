import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import type { WebhookHeaders } from "./types";

/**
 * Reads a header value case-insensitively from either a `Headers` instance or a plain record.
 * @param headers The headers to read from.
 * @param name The header name (case-insensitive).
 * @returns The first matching header value, or `undefined` when absent.
 */
export const getHeader = (headers: WebhookHeaders, name: string): string | undefined => {
    if (headers instanceof Headers) {
        return headers.get(name) ?? undefined;
    }

    const lowerName = name.toLowerCase();

    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
            if (Array.isArray(value)) {
                return value[0];
            }

            return value;
        }
    }

    return undefined;
};

/**
 * Compares two strings in constant time to avoid leaking byte-position information through timing.
 * @param a First value.
 * @param b Second value.
 * @returns `true` when the values are byte-for-byte equal.
 */
export const timingSafeStringEqual = (a: string, b: string): boolean => {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) {
        return false;
    }

    return timingSafeEqual(bufferA, bufferB);
};

/**
 * Checks whether a unix timestamp (in seconds) falls within the allowed tolerance window of now.
 * @param timestampSeconds The signed timestamp, in seconds.
 * @param tolerance Allowed difference in seconds. `0` disables the check.
 * @param now Current time in milliseconds (injectable for testing).
 * @returns `true` when the timestamp is fresh enough (or tolerance is disabled).
 */
export const isTimestampWithinTolerance = (timestampSeconds: number, tolerance: number, now: number = Date.now()): boolean => {
    if (tolerance <= 0) {
        return true;
    }

    if (!Number.isFinite(timestampSeconds)) {
        return false;
    }

    const difference = Math.abs(now / 1000 - timestampSeconds);

    return difference <= tolerance;
};
