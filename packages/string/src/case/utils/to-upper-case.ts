/**
 * Optimized toUpperCase with caching
 */

import type { NodeLocale } from "../../types";

/**
 * Optimized toUpperCase with caching
 */
export const toUpperCase = (string_: string, locale?: NodeLocale): string => {
    // Handle empty or non-string input
    if (typeof string_ !== "string") {
        return string_;
    }

    if (locale) {
        return string_.toLocaleUpperCase(locale);
    }

    return string_.toUpperCase();
};
