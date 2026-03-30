/**
 * Unified output module with standardized prefixes, symbols, and branding.
 *
 * Design: follows Rust compiler conventions (lowercase prefixes with bold coloring).
 * Integrates with the TUI CLIOutput class for task-runner output, and provides
 * standalone functions for all other command output.
 *
 * Features (per vite-plus CLI Output Polish RFC):
 * - Standardized symbols: ✓ (success), ✗ (failure), ⚠ (warning), → (transition)
 * - Lowercase prefixes: info:, warn:, error:, note:
 * - VIS branding via environment variable injection
 * - Pre-spawn banner for sub-tools
 * - Respects NO_COLOR and FORCE_COLOR environment variables
 */

// ── Color detection ──────────────────────────────────────────────────

const supportsColor = (): boolean => {
    if (process.env.NO_COLOR !== undefined) {
        return false;
    }

    if (process.env.FORCE_COLOR !== undefined) {
        return true;
    }

    if (!process.stderr.isTTY) {
        return false;
    }

    return true;
};

const colorEnabled = supportsColor();

// ── ANSI helpers (zero-dep, respects NO_COLOR) ───────────────────────

const ansi = (open: string, close: string) => (s: string): string =>
    colorEnabled ? `\x1B[${open}m${s}\x1B[${close}m` : s;

const bold = ansi("1", "22");
const dim = ansi("2", "22");
const red = ansi("31", "39");
const green = ansi("32", "39");
const yellow = ansi("33", "39");
const blue = ansi("34", "39");
const cyan = ansi("36", "39");
const gray = ansi("90", "39");
const inverse = ansi("7", "27");

// ── Symbols (with Unicode detection from tui/symbols.ts pattern) ─────

const isUnicodeSupported = (): boolean => {
    if (process.platform === "win32") {
        return Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color";
    }

    return process.env.TERM !== "linux";
};

const unicode = isUnicodeSupported();

const SYMBOLS = {
    arrow: unicode ? "\u2192" : "->",    // → transitions
    dash: unicode ? "\u2014" : "-",       // — separators
    failure: unicode ? "\u2717" : "x",    // ✗ failure (red)
    success: unicode ? "\u2713" : "v",    // ✓ success (green)
    warning: unicode ? "\u26A0" : "!",    // ⚠ warning (yellow)
} as const;

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

// ── Branding ─────────────────────────────────────────────────────────

/** The VIS version, injectable via VIS_VERSION environment variable */
const getVersion = (): string => {
    if (process.env.VIS_VERSION) {
        return process.env.VIS_VERSION;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
        return require("../../package.json").version;
    } catch {
        return "0.0.0";
    }
};

/** Renders the VIS badge: ` VIS ` in inverse styling */
const badge = (): string => inverse(bold(cyan(` VIS `)));

/**
 * Prints a branded banner line before spawning a sub-tool.
 *
 * Example output:
 *   VIS  v1.0.0 — build
 *
 * Only printed to TTY stderr (skipped in CI pipes).
 */
const printBanner = (command: string): void => {
    if (!process.stderr.isTTY) {
        return;
    }

    const version = getVersion();

    process.stderr.write(`${badge()}  ${dim(`v${version}`)} ${dim(SYMBOLS.dash)} ${command}\n`);
};

/**
 * Prints the startup banner with version info.
 *
 * Example output:
 *   VIS  v1.0.0  ready
 */
const printStartup = (): void => {
    if (!process.stderr.isTTY) {
        return;
    }

    const version = getVersion();

    process.stderr.write(`\n${badge()}  ${bold(`v${version}`)}  ${green("ready")}\n\n`);
};

/**
 * Sets the VIS_VERSION environment variable for child processes.
 * This allows sub-tools to read and display the vis version.
 */
const injectVersion = (): void => {
    process.env.VIS_VERSION = getVersion();
};

/**
 * Returns a full-width separator line using the dash character.
 */
const separator = (): string => {
    const width = process.stdout.columns || 80;

    return dim(SYMBOLS.dash.repeat(width));
};

/**
 * Formats a pass result line (for check-style commands).
 * Example: pass: All 989 files are correctly formatted (423ms, 16 threads)
 */
const pass = (message: string): void => {
    process.stderr.write(`${bold(green("pass:"))} ${message}\n`);
};

/**
 * Formats a fail result line (for check-style commands).
 * Example: fail: 3 files have formatting issues
 */
const fail = (message: string): void => {
    process.stderr.write(`${bold(red("fail:"))} ${message}\n`);
};

export {
    badge,
    blue,
    bold,
    cyan,
    dim,
    error,
    fail,
    failure,
    getVersion,
    gray,
    green,
    info,
    injectVersion,
    inverse,
    note,
    pass,
    printBanner,
    printStartup,
    red,
    separator,
    success,
    SYMBOLS,
    warn,
    yellow,
};
