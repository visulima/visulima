/* eslint-disable no-secrets/no-secrets, jsdoc/check-indentation */

/**
 * Constant to check if the path is visible to the calling process.
 * Corresponds to `node:fs.constants.F_OK`.
 */
export const F_OK = 0; // constants?.F_OK

/**
 * Constant to check if the path is readable to the calling process.
 * Corresponds to `node:fs.constants.R_OK`.
 */
export const R_OK = 4; // constants?.R_OK

/**
 * Constant to check if the path is writable to the calling process.
 * Corresponds to `node:fs.constants.W_OK`.
 */
export const W_OK = 2; // constants?.W_OK

/**
 * Constant to check if the path is executable by the calling process.
 * Corresponds to `node:fs.constants.X_OK`.
 */
export const X_OK = 1; // constants?.X_OK

/**
 * A special symbol that can be returned by the matcher function in `findUp` or `findUpSync`
 * to stop the search process prematurely.
 */
export const FIND_UP_STOP = Symbol("findUpStop");

/**
 * Regular expression for stripping comments from JSON.
 * Matches:
 * 1. Quoted strings: "example \"escaped\" string"
 * 2. Single-line comments: // comment
 * 3. Multi-line comments: /* comment *\/
 * @example
 * const json = `{
 *   // comment
 *   "key": "value" // comment
 * }`;
 * json.replace(INTERNAL_STRIP_JSON_REGEX, (match) =>
 *   /^"/.test(match) ? match : ''
 * );
 * // Result: { "key": "value" }
 */
export const INTERNAL_STRIP_JSON_REGEX = /"(?:[^"\\]|\\.)*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g;
