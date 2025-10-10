import { parseDuration } from "@visulima/humanizer";

/**
 * Convert a human-readable duration string to milliseconds.
 * @param value Duration value (number in ms or human-readable string)
 * @returns Duration in milliseconds, or null if parsing fails
 * @example
 * ```ts
 * toMilliseconds("5m") // 300000
 * toMilliseconds(5000) // 5000
 * ```
 */
const toMilliseconds = (value: number | string | undefined): number | null => {
    if (value === Number(value)) {
        return value;
    }

    if (!value) {
        return null;
    }

    const parsed = parseDuration(value as string);

    if (parsed === undefined) {
        return null;
    }

    return parsed;
};

export default toMilliseconds;
