import type { InboundAddress } from "./types";

// Anchored, linear patterns (no nested quantifiers) — safe from catastrophic backtracking.
// eslint-disable-next-line sonarjs/slow-regex
const MESSAGE_ID_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/;
const SURROUNDING_QUOTES_PATTERN = /^"|"$/g;

/**
 * Returns the value when it is a non-empty string, otherwise `undefined`.
 * @param value The value to normalize.
 * @returns The non-empty string, or `undefined`.
 */
export const nonEmpty = (value: string | undefined): string | undefined => {
    if (value === undefined || value.length === 0) {
        return undefined;
    }

    return value;
};

/**
 * Parses a single RFC 5322 address such as `John Doe &lt;john@example.com>` or `john@example.com`.
 * @param value The address string.
 * @returns The parsed address, or `undefined` when empty.
 */
export const parseAddress = (value: string | undefined | null): InboundAddress | undefined => {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    const angleStart = trimmed.lastIndexOf("<");
    const angleEnd = trimmed.lastIndexOf(">");

    if (angleStart !== -1 && angleEnd > angleStart) {
        const email = trimmed.slice(angleStart + 1, angleEnd).trim();
        const name = trimmed.slice(0, angleStart).trim().replaceAll(SURROUNDING_QUOTES_PATTERN, "").trim();

        return name ? { email, name } : { email };
    }

    return { email: trimmed };
};

/**
 * Splits and parses a comma-separated address list, respecting commas inside quoted display names.
 * @param value The address-list string.
 * @returns The parsed addresses (empty when none).
 */
export const parseAddressList = (value: string | undefined | null): InboundAddress[] => {
    if (!value) {
        return [];
    }

    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of value) {
        if (char === "\"") {
            inQuotes = !inQuotes;
            current += char;
        } else if (char === "," && !inQuotes) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        parts.push(current);
    }

    return parts.map((part) => parseAddress(part)).filter((address): address is InboundAddress => address !== undefined);
};

/**
 * Splits a `References` header value into individual Message-IDs.
 * @param value The raw `References` header.
 * @returns The Message-IDs in document order (oldest first).
 */
export const parseReferences = (value: string | undefined | null): string[] => {
    if (!value) {
        return [];
    }

    const matches = value.match(MESSAGE_ID_PATTERN);

    if (matches) {
        return matches.map((match) => match.trim());
    }

    return value
        .split(WHITESPACE_PATTERN)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
};

/**
 * Lower-cases all keys of a header record, keeping only stringifiable scalar values.
 * @param headers The raw headers.
 * @returns A new record with lower-cased keys.
 */
export const lowercaseHeaders = (headers: Record<string, unknown> | undefined): Record<string, string> => {
    const result: Record<string, string> = {};

    if (!headers) {
        return result;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") {
            result[key.toLowerCase()] = value;
        } else if (typeof value === "number" || typeof value === "boolean") {
            result[key.toLowerCase()] = String(value);
        }
    }

    return result;
};
