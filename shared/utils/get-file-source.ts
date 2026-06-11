import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Maximum number of distinct file sources kept in the in-memory cache.
 *
 * The cache backs error renderers that run inside long-lived dev servers
 * (the ono inspector, error-handler in production). Without a cap, every
 * distinct stack-frame path would add an entry that lives for the whole
 * process lifetime. We keep a bounded LRU instead so memory stays flat.
 */
const MAX_CACHE_ENTRIES = 50;

/**
 * Simple insertion-order LRU. `Map` preserves insertion order, so on every
 * read we delete + re-set the key to move it to the most-recently-used end,
 * and on insert we evict the oldest entry once we exceed the cap.
 */
const cache = new Map<string, string>();

const getFromCache = (key: string): string | undefined => {
    const value = cache.get(key);

    if (value === undefined) {
        return undefined;
    }

    // Refresh recency.
    cache.delete(key);
    cache.set(key, value);

    return value;
};

const setInCache = (key: string, value: string): void => {
    if (cache.has(key)) {
        cache.delete(key);
    } else if (cache.size >= MAX_CACHE_ENTRIES) {
        // Evict the least-recently-used entry (first key in insertion order).
        const oldest = cache.keys().next().value;

        if (oldest !== undefined) {
            cache.delete(oldest);
        }
    }

    cache.set(key, value);
};

export type GetFileSourceOptions = {
    /**
     * Allow fetching `http(s):` (and `data:`) stack-frame URLs over the network.
     *
     * `error.stack` is just a string and can be influenced by untrusted input
     * (re-thrown errors, eval'd code, client-reported errors). Servers that
     * render such errors (e.g. the ono inspector served over HTTP) would
     * otherwise issue requests to arbitrary internal/external URLs — a
     * server-side request forgery (SSRF) surface. Remote fetching is therefore
     * opt-in; by default only local files (`file:` URLs and absolute paths)
     * are read.
     *
     * @default false
     */
    allowRemote?: boolean;
};

/**
 * Reads the source code for a stack-frame path.
 *
 * Supports:
 * - `file:` URLs (read from disk),
 * - plain absolute filesystem paths (read from disk) — common in CommonJS and
 *   many V8 stack traces (`/home/user/app/index.js`),
 * - `http(s):`/`data:` URLs, but only when {@link GetFileSourceOptions.allowRemote}
 *   is set (off by default to avoid an SSRF surface).
 *
 * @param file The stack-frame path or URL.
 * @param options Optional behaviour flags.
 * @returns The file source, or `undefined` when it can't be (safely) read.
 */
const getFileSource = async (file: string, options: GetFileSourceOptions = {}): Promise<string | undefined> => {
    const { allowRemote = false } = options;

    const cached = getFromCache(file);

    if (cached !== undefined) {
        return cached;
    }

    // Local file URL.
    if (file.startsWith("file:")) {
        try {
            const source = await readFile(fileURLToPath(file), "utf8");

            setInCache(file, source);

            return source;
        } catch {
            return undefined;
        }
    }

    // Remote URLs are gated behind an explicit opt-in to avoid SSRF.
    if (/^(?:https?|data):/.test(file)) {
        if (!allowRemote) {
            return undefined;
        }

        try {
            const response = await fetch(file);

            if (!response.ok) {
                return undefined;
            }

            const source = await response.text();

            setInCache(file, source);

            return source;
        } catch {
            return undefined;
        }
    }

    // Plain absolute filesystem path (CJS / V8 stacks emit these directly).
    if (isAbsolute(file)) {
        try {
            const source = await readFile(file, "utf8");

            setInCache(file, source);

            return source;
        } catch {
            return undefined;
        }
    }

    return undefined;
};

/**
 * Clears the file source cache.
 * Useful for testing and cleanup.
 */
export const clearFileSourceCache = (): void => {
    cache.clear();
};

export default getFileSource;
