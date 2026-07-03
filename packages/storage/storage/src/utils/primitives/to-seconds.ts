import { parseDuration } from "@visulima/humanizer";

/**
 * Convert a human-readable duration string to seconds.
 * @param value Duration value (number in seconds or human-readable string)
 * @returns Duration in seconds
 * @example
 * ```ts
 * toSeconds("5m") // 300
 * toSeconds(300) // 300
 * ```
 */
const toSeconds = (value: number | string): number => {
    if (value === Number(value)) {
        return value;
    }

    // milliseconds to seconds
    return (parseDuration(value as string) ?? 0) / 1000;
};

export default toSeconds;
