// eslint-disable-next-line import/no-extraneous-dependencies
import isGlobImpl from "is-glob";

/**
 * Options accepted by {@link isGlob}.
 */
interface IsGlobOptions {
    /**
     * When `false`, matches more permissively — any string containing unescaped glob
     * meta characters (`*`, `?`, `{}`, `()`, `[]`) is treated as a glob, even when the
     * sequence is not a valid glob expression.
     * @default true
     */
    strict?: boolean;
}

/**
 * Returns `true` if the given value looks like a glob pattern (including extglobs like `@(foo|bar)`).
 *
 * Escaped meta characters (e.g. `\\*`) are not considered globs. Non-string values always return `false`.
 *
 * Powered by [`is-glob`](https://github.com/micromatch/is-glob) which is bundled into the built output so it does
 * not appear as a runtime dependency of `@visulima/fs`.
 * @param value The value to inspect.
 * @param options Optional configuration. See {@link IsGlobOptions}.
 * @returns `true` if `value` looks like a glob pattern, otherwise `false`.
 * @example
 * ```javascript
 * import { isGlob } from "@visulima/fs";
 *
 * isGlob("src/**\/*.ts"); // true
 * isGlob("src/index.ts"); // false
 * isGlob("src/\\*.ts"); // false — escaped
 * isGlob("!foo.js"); // true — negation
 * ```
 */
const isGlob = (value: unknown, options?: IsGlobOptions): boolean => isGlobImpl(value as string, options);

export type { IsGlobOptions };
export default isGlob;
