import colorizeTemplate from "@visulima/colorize/template";

// Cache for template formatting to avoid repeated string operations
// Uses LRU-like eviction when cache grows too large
const formatCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/**
 * Formats templates with intelligent caching.
 *
 * Command metadata (descriptions, examples, option names) is user-supplied and
 * routinely contains literal braces — `engines.{node,pnpm}`, `dependencies: {}`,
 * `vis-release{,-check,-snapshot}.yml`. The colorize template parser reads `{`/`}`
 * as style markup and throws on anything it can't parse ("Found extraneous } in
 * template literal", "template literal is missing N closing brackets"), which
 * previously aborted `--help` before a single line was printed.
 *
 * A string that doesn't parse as a template is treated as plain text and returned
 * verbatim, so the braces render exactly as the author wrote them.
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

    let result: string;

    try {
        result = colorizeTemplate(Object.assign([], { raw: [string_] }));
    } catch {
        result = string_;
    }

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
