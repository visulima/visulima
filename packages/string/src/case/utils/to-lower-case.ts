/**
 * Optimized toLowerCase with caching
 */

import type { NodeLocale } from "../../types";

/**
 * Optimized toLowerCase with caching
 */
export const toLowerCase = (string_: string, locale?: NodeLocale): string => {
    // Handle empty or non-string input
    if (typeof string_ !== "string") {
        return string_;
    }

    if (locale) {
        return string_.toLocaleLowerCase(locale);
    }

    return string_.toLowerCase();
};
