// eslint-disable-next-line import/no-extraneous-dependencies
import { glob as tinyGlob } from "tinyglobby";

import type { GlobOptions } from "../types";

/**
 * Asynchronously matches files on disk using one or more glob patterns.
 *
 * Powered by [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby); `tinyglobby` is bundled into the
 * built output so it does not appear as a runtime dependency of `@visulima/fs`.
 *
 * Pattern forms:
 *
 * - Plain glob — `src/**\/*.ts`
 * - Negated pattern — `!src/**\/*.spec.ts` inside `patterns` adds to the internal ignore list (same as passing it via `ignore`).
 * - Negated ignore — a leading `!` inside {@link GlobOptions.ignore} _un-ignores_ entries that an earlier ignore pattern would drop, e.g. `ignore: ["dist/**", "!dist/index.d.ts"]`.
 * @param patterns A single glob pattern or an array of glob patterns.
 * @param options Optional glob options. See {@link GlobOptions}.
 * @returns A promise resolving to the array of matched paths. Paths are relative to {@link GlobOptions.cwd} unless {@link GlobOptions.absolute} is `true`.
 * @example
 * ```javascript
 * import { glob } from "@visulima/fs";
 *
 * const jsFiles = await glob("src/**\/*.{js,ts}", { cwd: process.cwd(), ignore: ["**\/node_modules/**"] });
 * console.log(jsFiles);
 *
 * // Negated ignore: drop everything under `ignored/` except `ignored/keep.ts`.
 * const keep = await glob("**\/*.ts", { ignore: ["ignored/**", "!ignored/keep.ts"] });
 * ```
 */
const glob = async (patterns: string | ReadonlyArray<string>, options?: GlobOptions): Promise<string[]> => await tinyGlob(patterns, options);

export default glob;
