/**
 * Optimized string operations using array joins instead of concatenation
 */

import type { NodeLocale } from "../../types";

/**
 * Optimized toLowerCase with caching
 */
export const toLowerCase = (string_: string, locale?: NodeLocale): string => {
    // Handle empty or non-string input
    if (!string_ || typeof string_ !== "string") {
        return string_;
    }

    return locale ? string_.toLocaleLowerCase(locale) : string_.toLowerCase();
};

/**
 * Optimized toUpperCase with caching
 */
export const toUpperCase = (string_: string, locale?: NodeLocale): string => {
    // Handle empty or non-string input
    if (!string_ || typeof string_ !== "string") {
        return string_;
    }

    return locale ? string_.toLocaleUpperCase(locale) : string_.toUpperCase();
};

/**
 * Optimized string array join
 */
export const fastJoin = (array: string[], separator: string): string => {
    if (array.length === 0) {
        return "";
    }

    if (array.length === 1) {
        return array[0] as string;
    }

    // Use array buffer for better performance with large arrays
    if (array.length > 100) {
        return array.join(separator);
    }

    // For smaller arrays, manual concatenation can be faster
    let result = array[0];

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 1; index < array.length; index++) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        result += separator + array[index];
    }

    return result as string;
};
