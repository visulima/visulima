// eslint-disable-next-line import/no-extraneous-dependencies
import picomatch from "picomatch";

/**
 * Options accepted by {@link match} and {@link matcher}.
 *
 * Mirrors `picomatch.PicomatchOptions`; passed straight through to
 * [`picomatch`](https://github.com/micromatch/picomatch#options); see its
 * documentation for the full list.
 */
// Mirrored inline (rather than `picomatch.PicomatchOptions`) because the DTS
// bundler chases picomatch's `import picomatch = require("./lib/picomatch")`
// namespace re-export and emits a broken `./lib/picomatch` import in the
// output `match.d.ts`. Keeping the surface explicit also makes the public
// option list visible without cross-package navigation.
export interface MatchOptions {
    basename?: boolean;
    bash?: boolean;
    capture?: boolean;
    contains?: boolean;
    debug?: boolean;
    dot?: boolean;
    expandRange?:
        | ((from: string, to: string, options: MatchOptions) => string)
        | ((from: string, to: string, step: string, options: MatchOptions) => string);
    fastpaths?: boolean;
    flags?: string;
    format?: (string_: string) => string;
    ignore?: string | string[];
    keepQuotes?: boolean;
    literalBrackets?: boolean;
    matchBase?: boolean;
    maxLength?: number;
    nobrace?: boolean;
    nobracket?: boolean;
    nocase?: boolean;
    noext?: boolean;
    noextglob?: boolean;
    noglobstar?: boolean;
    nonegate?: boolean;
    onIgnore?: (result: unknown) => void;
    onMatch?: (result: unknown) => void;
    onResult?: (result: unknown) => void;
    posix?: boolean;
    prepend?: boolean;
    regex?: boolean;
    strictBrackets?: boolean;
    strictSlashes?: boolean;
    unescape?: boolean;
    windows?: boolean;
}

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
    // Cast: MatchOptions mirrors picomatch.PicomatchOptions but uses `unknown`
    // in callback parameters to avoid the DTS bundler chasing picomatch's
    // namespace re-export. Shapes are compatible at runtime.
    const isMatch = picomatch(pattern, options as Parameters<typeof picomatch>[1]);

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
export const matcher = (pattern: string | string[], options?: MatchOptions): (value: string) => boolean => {
    // Cast: MatchOptions mirrors picomatch.PicomatchOptions but uses `unknown`
    // in callback parameters to avoid the DTS bundler chasing picomatch's
    // namespace re-export. Shapes are compatible at runtime.
    const isMatch = picomatch(pattern, options as Parameters<typeof picomatch>[1]);

    // Wrap so extra arguments (e.g. `(value, index, array)` from Array.prototype.filter) do not
    // trigger picomatch's `returnObject` path, which would otherwise return a truthy object.
    return (value: string): boolean => isMatch(value);
};
