/* eslint-disable import/prefer-default-export */

/**
 * Get the count of `substring` in `value`.
 * @param value Content to search in. Will be coerced to string.
 * @param substring Substring to look for, typically one character.
 * @returns Count of `substring`s in `value`.
 * @throws {TypeError} When substring is not a string or is empty.
 */
export const countOccurrences = (value: unknown, substring: string): number => {
    const source = String(value);

    if (typeof substring !== "string") {
        throw new TypeError("Expected character");
    }

    if (substring.length === 0) {
        throw new TypeError("Expected non-empty substring");
    }

    let count = 0;
    let index = source.indexOf(substring);

    while (index !== -1) {
        // eslint-disable-next-line no-plusplus
        count++;
        const nextIndex = index + substring.length;

        // Prevent infinite loop: ensure we always advance
        if (nextIndex <= index) {
            break;
        }

        index = source.indexOf(substring, nextIndex);
    }

    return count;
};
