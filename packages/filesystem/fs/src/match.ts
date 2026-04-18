import type { PicomatchOptions } from "picomatch";
// eslint-disable-next-line import/no-extraneous-dependencies
import picomatch from "picomatch";

/**
 * Options accepted by {@link match} and {@link matcher}.
 *
 * Passed straight through to [`picomatch`](https://github.com/micromatch/picomatch#options); see its documentation for the full list.
 */
export type MatchOptions = PicomatchOptions;

/**
 * Tests whether a path matches one or more glob patterns.
 *
 * Powered by [`picomatch`](https://github.com/micromatch/picomatch) which is bundled into the built output so it does
 * not appear as a runtime dependency of `@visulima/fs`.
 *
 * If you match many values against the same pattern, prefer {@link matcher} to compile the pattern once.
 * @param value The path (or paths) to test.
 * @param pattern A single glob or array of globs.
 * @param options Optional picomatch options. See {@link MatchOptions}.
 * @returns `true` if `value` matches any of `pattern`.
 * @example
 * ```javascript
 * import { match } from "@visulima/fs";
 *
 * match("src/index.ts", "src/**\/*.ts"); // true
 * match("src/index.ts", ["**\/*.js", "**\/*.ts"]); // true
 * match("src/index.ts", "**\/*.js"); // false
 * ```
 */
export const match = (value: string | string[], pattern: string | string[], options?: MatchOptions): boolean => {
    const isMatch = picomatch(pattern, options);

    if (Array.isArray(value)) {
        return value.some((entry) => isMatch(entry));
    }

    return isMatch(value);
};

/**
 * Compiles a glob pattern into a reusable matcher function.
 *
 * Powered by [`picomatch`](https://github.com/micromatch/picomatch) which is bundled into the built output so it does
 * not appear as a runtime dependency of `@visulima/fs`.
 * @param pattern A single glob or array of globs.
 * @param options Optional picomatch options. See {@link MatchOptions}.
 * @returns A function that returns `true` when its argument matches the compiled pattern.
 * @example
 * ```javascript
 * import { matcher } from "@visulima/fs";
 *
 * const isTs = matcher("**\/*.ts");
 * ["a.ts", "b.js", "c.ts"].filter(isTs); // ["a.ts", "c.ts"]
 * ```
 */
export const matcher = (pattern: string | string[], options?: MatchOptions): ((value: string) => boolean) => {
    const isMatch = picomatch(pattern, options);

    // Wrap so extra arguments (e.g. `(value, index, array)` from Array.prototype.filter) do not
    // trigger picomatch's `returnObject` path, which would otherwise return a truthy object.
    return (value: string): boolean => isMatch(value);
};
