import LRUCache from "./lru-cache";

/**
 * Cache for dynamically created regexes with LRU-like behavior
 */
const regexCache = new LRUCache<string, RegExp>(1000);

const RE_ESCAPE_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * Creates or retrieves a cached regex for custom separators.
 * @param separators Array of separator strings to create a regex pattern from
 * @returns A RegExp object that matches any of the specified separators
 */
const getSeparatorsRegex = (separators: ReadonlyArray<string>): RegExp => {
    const key = separators.join("");

    if (regexCache.has(key)) {
        const cached = regexCache.get(key) as RegExp;

        // The cached RegExp carries the global flag and a stateful lastIndex; reset it
        // before handing the shared instance to a caller so exec/test start from 0.
        cached.lastIndex = 0;

        return cached;
    }

    const pattern = separators.map((s) => s.replaceAll(RE_ESCAPE_SPECIAL, String.raw`\$&`)).join("|");
    const regex = new RegExp(pattern, "g");

    regexCache.set(key, regex);

    return regex;
};

export default getSeparatorsRegex;
