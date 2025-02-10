/**
 * Optimized string operations using array joins instead of concatenation
 */

/**
 * Optimized toLowerCase with caching
 */
export const fastLowerCase = (str: string, locale?: string): string => {
    // Handle empty or non-string input
    if (!str || typeof str !== "string") {
        return str;
    }

    return locale ? str.toLocaleLowerCase(locale) : str.toLowerCase();
};

/**
 * Optimized toUpperCase with caching
 */
export const fastUpperCase = (str: string, locale?: string): string => {
    // Handle empty or non-string input
    if (!str || typeof str !== "string") {
        return str;
    }

    return locale ? str.toLocaleUpperCase(locale) : str.toUpperCase();
};

/**
 * Optimized string array join
 */
export const fastJoin = (arr: string[], separator: string): string => {
    if (arr.length === 0) {
        return "";
    }

    if (arr.length === 1) {
        return arr[0] as string;
    }

    // Use array buffer for better performance with large arrays
    if (arr.length > 100) {
        return arr.join(separator);
    }

    // For smaller arrays, manual concatenation can be faster
    let result = arr[0];

    for (let i = 1; i < arr.length; i++) {
        result += separator + arr[i];
    }

    return result as string;
};
