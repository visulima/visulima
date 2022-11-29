import duration from "parse-duration";

/**
 * Convert a human-readable duration to seconds
 */
const toSeconds = (value: string | number): number => {
    if (value === Number(value)) {
        return value;
    }

    return duration(value as string, "sec");
};

export default toSeconds;
