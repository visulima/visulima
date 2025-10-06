import { parseDuration } from "@visulima/humanizer";

/**
 * Convert a human-readable duration to seconds
 */
const toSeconds = (value: number | string): number => {
    if (value === Number(value)) {
        return value;
    }

    // milliseconds to seconds
    return (parseDuration(value as string) ?? 0) / 1000;
};

export default toSeconds;
