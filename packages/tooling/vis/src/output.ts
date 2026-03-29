/**
 * Unified output module with standardized prefixes and symbols.
 * Follows Rust compiler conventions: lowercase prefixes with bold coloring.
 */

// ── Symbols ──────────────────────────────────────────────────────────
const SYMBOLS = {
    arrow: "\u2192",   // → transitions
    failure: "\u2717", // ✗ failure (red)
    success: "\u2713", // ✓ success (green)
    warning: "\u26A0", // ⚠ warning (yellow)
} as const;

// ── ANSI colors ──────────────────────────────────────────────────────
const bold = (s: string): string => `\x1B[1m${s}\x1B[22m`;
const red = (s: string): string => `\x1B[31m${s}\x1B[39m`;
const green = (s: string): string => `\x1B[32m${s}\x1B[39m`;
const yellow = (s: string): string => `\x1B[33m${s}\x1B[39m`;
const blue = (s: string): string => `\x1B[34m${s}\x1B[39m`;
const gray = (s: string): string => `\x1B[90m${s}\x1B[39m`;
const dim = (s: string): string => `\x1B[2m${s}\x1B[22m`;

// ── Prefixed output functions ────────────────────────────────────────

/** Informational message with blue bold `info:` prefix */
const info = (message: string): void => {
    process.stderr.write(`${bold(blue("info:"))} ${message}\n`);
};

/** Warning with yellow bold `warn:` prefix */
const warn = (message: string): void => {
    process.stderr.write(`${bold(yellow("warn:"))} ${message}\n`);
};

/** Error with red bold `error:` prefix */
const error = (message: string): void => {
    process.stderr.write(`${bold(red("error:"))} ${message}\n`);
};

/** Supplementary information with gray bold `note:` prefix */
const note = (message: string): void => {
    process.stderr.write(`${bold(gray("note:"))} ${message}\n`);
};

/** Success line with green checkmark */
const success = (message: string): void => {
    process.stderr.write(`${green(SYMBOLS.success)} ${message}\n`);
};

/** Failure line with red X */
const failure = (message: string): void => {
    process.stderr.write(`${red(SYMBOLS.failure)} ${message}\n`);
};

export { bold, blue, dim, error, failure, gray, green, info, note, red, success, SYMBOLS, warn, yellow };
