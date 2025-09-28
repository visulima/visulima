import { parseDuration } from "@visulima/humanizer";

/**
 * Convert a human-readable duration to ms
 */
const toMilliseconds = (value: number | string | undefined): number | null => {
    if (value === Number(value)) {
        return value;
    }

    if (!value) {
        return null;
    }

    return parseDuration(value as string, "ms");
};

export default toMilliseconds;
