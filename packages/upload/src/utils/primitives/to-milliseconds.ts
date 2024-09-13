import duration from "parse-duration";

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

    return duration(value as string, "ms");
};

export default toMilliseconds;
