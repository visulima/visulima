const isUnicodeSupported = (): boolean => {
    if (process.platform === "win32") {
        return Boolean(process.env["WT_SESSION"]) || process.env["TERM_PROGRAM"] === "vscode" || process.env["TERM"] === "xterm-256color";
    }

    return process.env["TERM"] !== "linux";
};

const unicode: boolean = isUnicodeSupported();

export const TICK: string = unicode ? "\u2713" : "\u221A"; // ✓ or √
export const CROSS: string = unicode ? "\u2716" : "\u00D7"; // ✖ or ×
export const ELLIPSIS: string = unicode ? "\u2026" : "...";
export const DASH: string = unicode ? "\u2014" : "-";
export const WARNING: string = unicode ? "\u26A0" : "!"; // \u26A0 or !
