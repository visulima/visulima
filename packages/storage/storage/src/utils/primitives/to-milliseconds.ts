import { parseDuration } from "@visulima/humanizer";

/**
 * Convert a human-readable duration string to milliseconds.
 * @param value Duration value (number in ms or human-readable string)
 * @returns Duration in milliseconds, or undefined if parsing fails
 * @example
 * ```ts
 * toMilliseconds("5m") // 300000
 * toMilliseconds(5000) // 5000
 * ```
 */
const toMilliseconds = (value: number | string | undefined): number | undefined => {
    if (value === Number(value)) {
        return value;
    }

    if (!value) {
        return undefined;
    }

    const parsed = parseDuration(value as string);

    if (parsed === undefined) {
        return undefined;
    }

    return parsed;
};

export default toMilliseconds;
