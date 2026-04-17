// eslint-disable-next-line import/no-extraneous-dependencies
import { globSync as tinyGlobSync } from "tinyglobby";

import type { GlobOptions } from "../types";

/**
 * Synchronously matches files on disk using one or more glob patterns.
 *
 * Synchronous counterpart of `glob`. Powered by [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby);
 * bundled into the built output so it does not appear as a runtime dependency of `@visulima/fs`.
 *
 * Pattern forms:
 *
 * - Plain glob — `src/**\/*.ts`
 * - Negated pattern — `!src/**\/*.spec.ts` inside `patterns` adds to the internal ignore list.
 * - Negated ignore — a leading `!` inside {@link GlobOptions.ignore} _un-ignores_ entries that an earlier ignore pattern would drop, e.g. `ignore: ["dist/**", "!dist/index.d.ts"]`.
 * @param patterns A single glob pattern or an array of glob patterns.
 * @param options Optional glob options. See {@link GlobOptions}.
 * @returns The array of matched paths. Paths are relative to {@link GlobOptions.cwd} unless {@link GlobOptions.absolute} is `true`.
 * @example
 * ```javascript
 * import { globSync } from "@visulima/fs";
 *
 * const jsFiles = globSync(["src/**\/*.ts", "!**\/*.spec.ts"]);
 * console.log(jsFiles);
 *
 * // Negated ignore: drop everything under `ignored/` except `ignored/keep.ts`.
 * const keep = globSync("**\/*.ts", { ignore: ["ignored/**", "!ignored/keep.ts"] });
 * ```
 */
const globSync = (patterns: string | ReadonlyArray<string>, options?: GlobOptions): string[] => tinyGlobSync(patterns, options);

export default globSync;
