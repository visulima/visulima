/** Is the path visible to the calling process? */
export const F_OK = 0; // constants?.F_OK

/** Is the path readable to the calling process? */
export const R_OK = 4; // constants?.R_OK

/** Is the path writable to the calling process? */
export const W_OK = 2; // constants?.W_OK

/** Is the path executable to the calling process? */
export const X_OK = 1; // constants?.X_OK

export const FIND_UP_STOP = Symbol("findUpStop");
/**
 * Regular expression for stripping comments from JSON.
 * Matches:
 * 1. Quoted strings: "example \"escaped\" string"
 * 2. Single-line comments: // comment
 * 3. Multi-line comments: /* comment *\/
 *
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
export const INTERNAL_STRIP_JSON_REGEX = /"(?:[^"\\]|\\.)*"|\/\/[^\r\n]*|\/\*(?:[^*]|\*[^/])*\*\//g;
