import duration from "parse-duration";

/**
 * Convert a human-readable duration to seconds
 */
const toSeconds = (value: number | string): number => {
    if (value === Number(value)) {
        return value;
    }

    return duration(value as string, "sec");
};

export default toSeconds;
