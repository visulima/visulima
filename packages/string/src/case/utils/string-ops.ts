/**
 * Optimized string operations using array joins instead of concatenation
 */

// Separate caches for upper and lower case operations
const lowerCaseCache = new Map<string, string>();
const upperCaseCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

// Helper function to clear half of a cache when it gets too big
const clearHalfCache = (cache: Map<string, string>) => {
    if (cache.size >= CACHE_MAX_SIZE) {
        const entries = Array.from(cache.entries());
        entries.slice(0, CACHE_MAX_SIZE / 2).forEach(([k]) => cache.delete(k));
    }
};

/**
 * Optimized toLowerCase with caching
 */
export const fastLowerCase = (str: string, locale?: string): string => {
    // Handle empty or non-string input
    if (!str || typeof str !== "string") {
        return str;
    }

    const key = `${str}:${locale || "default"}`;
    let result = lowerCaseCache.get(key);
    
    if (!result) {
        result = locale ? str.toLocaleLowerCase(locale) : str.toLowerCase();
        clearHalfCache(lowerCaseCache);
        lowerCaseCache.set(key, result);
    }
    
    return result;
};

/**
 * Optimized toUpperCase with caching
 */
export const fastUpperCase = (str: string, locale?: string): string => {
    // Handle empty or non-string input
    if (!str || typeof str !== "string") {
        return str;
    }

    const key = `${str}:${locale || "default"}`;
    let result = upperCaseCache.get(key);
    
    if (!result) {
        result = locale ? str.toLocaleUpperCase(locale) : str.toUpperCase();
        clearHalfCache(upperCaseCache);
        upperCaseCache.set(key, result);
    }
    
    return result;
};

/**
 * Optimized string array join
 */
export const fastJoin = (arr: string[], separator: string): string => {
    if (arr.length === 0) return "";
    if (arr.length === 1) return arr[0];
    
    // Use array buffer for better performance with large arrays
    if (arr.length > 100) {
        return arr.join(separator);
    }
    
    // For smaller arrays, manual concatenation can be faster
    let result = arr[0];
    for (let i = 1; i < arr.length; i++) {
        result += separator + arr[i];
    }
    return result;
};
