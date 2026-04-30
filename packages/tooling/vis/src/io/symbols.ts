// ── Symbols (with Unicode detection from tui/symbols.ts pattern) ─────

const isUnicodeSupported = (): boolean => {
    if (process.platform === "win32") {
        return Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color";
    }

    return process.env.TERM !== "linux";
};

const unicode = isUnicodeSupported();

export const SYMBOLS: {
    readonly arrow: string;
    readonly dash: string;
    readonly failure: string;
    readonly success: string;
    readonly warning: string;
} = {
    arrow: unicode ? "→" : "->", // → transitions
    dash: unicode ? "—" : "-", // — separators
    failure: unicode ? "✗" : "x", // ✗ failure (red)
    success: unicode ? "✓" : "v", // ✓ success (green)
    warning: unicode ? "⚠" : "!", // ⚠ warning (yellow)
};
