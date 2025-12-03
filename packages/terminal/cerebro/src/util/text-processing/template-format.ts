import colorizeTemplate from "@visulima/colorize/template";

// Cache for template formatting to avoid repeated string operations
// Uses LRU-like eviction when cache grows too large
const formatCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/**
 * Formats templates with intelligent caching.
 */
const templateFormat = (string_?: string): string => {
    if (!string_) {
        return "";
    }

    // Fast path for empty strings
    if (string_ === "") {
        return "";
    }

    // Check cache first
    const cached = formatCache.get(string_);

    if (cached !== undefined) {
        return cached;
    }

    const result = colorizeTemplate(Object.assign([], { raw: [string_] }));

    // Intelligent cache management
    if (formatCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (simple FIFO eviction)
        const firstKey = formatCache.keys().next().value;

        if (firstKey !== undefined) {
            formatCache.delete(firstKey);
        }
    }

    formatCache.set(string_, result);

    return result;
};

export default templateFormat;
