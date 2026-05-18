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

export default trimSlashes;
