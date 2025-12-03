import LRUCache from "./lru-cache";

/**
 * Cache for dynamically created regexes with LRU-like behavior
 */
const regexCache = new LRUCache<string, RegExp>(1000);

/**
 * Creates or retrieves a cached regex for custom separators
 * @param separators Array of separator strings to create a regex pattern from
 * @returns A RegExp object that matches any of the specified separators
 */
const getSeparatorsRegex = (separators: ReadonlyArray<string>): RegExp => {
    const key = separators.join("");

    if (regexCache.has(key)) {
        return regexCache.get(key) as RegExp;
    }

    const pattern = separators.map((s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).join("|");
    const regex = new RegExp(pattern, "g");

    regexCache.set(key, regex);

    return regex;
};

export default getSeparatorsRegex;
