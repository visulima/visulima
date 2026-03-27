/**
 * Unicode symbols for TUI output with ASCII fallbacks.
 */

const isUnicodeSupported = (): boolean => {
    if (process.platform === "win32") {
        return Boolean(process.env["WT_SESSION"]) || process.env["TERM_PROGRAM"] === "vscode" || process.env["TERM"] === "xterm-256color";
    }

    return process.env["TERM"] !== "linux";
};

const unicode: boolean = isUnicodeSupported();

export const TICK: string = unicode ? "\u2713" : "\u221A"; // ✓ or √
export const CROSS: string = unicode ? "\u2716" : "\u00D7"; // ✖ or ×
export const ARROW_RIGHT: string = unicode ? "\u2192" : "->";
export const ELLIPSIS: string = unicode ? "\u2026" : "...";
export const SQUARE_FILLED: string = unicode ? "\u25A0" : "#";
export const DASH: string = unicode ? "\u2014" : "-";

/**
 * Braille spinner frames for dynamic TUI.
 */
export const SPINNER_FRAMES: ReadonlyArray<string> = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"] as const;
