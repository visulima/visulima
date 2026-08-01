/**
 * Checks if the current environment is a browser-like environment.
 * It specifically checks for the presence of `globalThis.window.document`.
 */

const isBrowser
    = typeof globalThis !== "undefined"
        && typeof (globalThis as Record<string, unknown>).window === "object"
        && ((globalThis as Record<string, unknown>).window as Record<string, unknown>).document !== undefined;

const OSTYPE_REGEX = /^(?:msys|cygwin)$/;

/**
 * Reference to the `process` global that is safe to read in runtimes without one
 * (web workers, edge runtimes, browser ESM without shims), where dereferencing
 * `process` at module evaluation would otherwise throw a `ReferenceError`.
 */
const nodeProcess = typeof process === "undefined" ? undefined : process;

/**
 * The environment map, or an empty object when the runtime ships a `process` shim
 * that has no `env` (bundler `define` stubs, edge runtimes without `nodejs_compat`).
 * Reading `nodeProcess.env.X` directly would throw a `TypeError` at module
 * evaluation there and take down every module that imports this one.
 */
const environment: Record<string, string | undefined> = nodeProcess?.env ?? {};

/**
 * Indicates whether the code is running inside Apple's Terminal.app.
 * This is true if not in a browser and the `TERM_PROGRAM` environment variable is "Apple_Terminal".
 */
export const isTerminalApp: boolean = !isBrowser && environment.TERM_PROGRAM === "Apple_Terminal";

/**
 * Indicates whether the current platform is Windows.
 * This is true if not in a browser and `process.platform` is "win32".
 */
export const isWindows: boolean
    = !isBrowser && (nodeProcess?.platform === "win32" || (environment.OSTYPE !== undefined && OSTYPE_REGEX.test(environment.OSTYPE)));
