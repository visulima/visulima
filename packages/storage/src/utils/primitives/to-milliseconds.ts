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

    const parsed = parseDuration(value as string);

    if (parsed === undefined) {
        return null;
    }

    return parsed;
};

export default toMilliseconds;
