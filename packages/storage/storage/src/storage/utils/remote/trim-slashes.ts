/**
 * Strips leading and trailing forward slashes without allocating when the
 * input is already clean.
 */
const trimSlashes = (value: string): string => {
    let start = 0;
    let end = value.length;

    while (start < end && value[start] === "/") {
        start += 1;
    }

    while (end > start && value[end - 1] === "/") {
        end -= 1;
    }

    return start === 0 && end === value.length ? value : value.slice(start, end);
};

/**
 * Strips trailing forward slashes only, in linear time (a `/\/+$/` replace backtracks on long runs).
 * @param value Path or URL
 * @returns The value without trailing slashes
 */
export const trimTrailingSlashes = (value: string): string => {
    let end = value.length;

    while (end > 0 && value[end - 1] === "/") {
        end -= 1;
    }

    return end === value.length ? value : value.slice(0, end);
};

export default trimSlashes;
