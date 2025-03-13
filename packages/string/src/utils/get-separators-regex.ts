/**
 * Cache for dynamically created regexes with LRU-like behavior
 */
const regexCache = new Map<string, RegExp>();
const regexCacheOrder: string[] = [];

/**
 * Creates or retrieves a cached regex for custom separators
 *
 * @param separators - Array of separator strings to create a regex pattern from
 * @returns A RegExp object that matches any of the specified separators
 */
const getSeparatorsRegex = (separators: ReadonlyArray<string>): RegExp => {
    const key = separators.join("");

    let regex = regexCache.get(key);

    if (regex) {
        // Move to end of LRU list
        const index = regexCacheOrder.indexOf(key);

        if (index > -1) {
            regexCacheOrder.splice(index, 1);
            regexCacheOrder.push(key);
        }
    } else {
        const pattern = separators.map((s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
        regex = new RegExp(pattern, "g");

        // Implement simple LRU-like caching
        if (regexCache.size >= 100) {
            const oldestKey = regexCacheOrder.shift();

            if (oldestKey) {
                regexCache.delete(oldestKey);
            }
        }

        regexCache.set(key, regex);
        regexCacheOrder.push(key);
    }

    return regex;
};

export default getSeparatorsRegex;
