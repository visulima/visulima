// eslint-disable-next-line import/no-extraneous-dependencies
import globParentImpl from "glob-parent";

/**
 * Options accepted by {@link globParent}.
 */
interface GlobParentOptions {
    /**
     * On Windows, flip backslashes to forward slashes before analysing the pattern.
     *
     * Disable when the input contains backslash escape sequences you want to preserve.
     * @default true
     */
    flipBackslashes?: boolean;
}

/**
 * Extracts the non-glob parent directory from a glob pattern.
 *
 * Useful when you need to know which directory to watch or walk for a given pattern — for example
 * `src/**\/*.ts` → `src`, `foo/{a,b}/*.js` → `foo`. Patterns without glob characters are returned
 * unchanged.
 *
 * Powered by [`glob-parent`](https://github.com/gulpjs/glob-parent) which is bundled into the built output so
 * it does not appear as a runtime dependency of `@visulima/fs`.
 * @param pattern The glob pattern to inspect.
 * @param options Optional configuration. See {@link GlobParentOptions}.
 * @returns The static parent path of the glob.
 * @example
 * ```javascript
 * import { globParent } from "@visulima/fs";
 *
 * globParent("src/**\/*.ts"); // "src"
 * globParent("foo/{a,b}/*.js"); // "foo"
 * globParent("foo/bar.js"); // "foo/bar.js"
 * ```
 */
const globParent = (pattern: string, options?: GlobParentOptions): string => globParentImpl(pattern, options);

export type { GlobParentOptions };
export default globParent;
