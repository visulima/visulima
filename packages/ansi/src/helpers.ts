/**
 * Checks if the current environment is a browser-like environment.
 * It specifically checks for the presence of `globalThis.window.document`.
 */

const isBrowser = globalThis?.window?.document !== undefined;

/**
 * Indicates whether the code is running inside Apple's Terminal.app.
 * This is true if not in a browser and the `TERM_PROGRAM` environment variable is "Apple_Terminal".
 */
export const isTerminalApp: boolean = !isBrowser && process.env.TERM_PROGRAM === "Apple_Terminal";

/**
 * Indicates whether the current platform is Windows.
 * This is true if not in a browser and `process.platform` is "win32".
 */
export const isWindows: boolean = !isBrowser && process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);
