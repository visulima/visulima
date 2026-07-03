/**
 * OSC 52 clipboard protocol utilities.
 *
 * OSC 52 allows terminal applications to read/write the system clipboard
 * via escape sequences. Format: ESC ] 52 ; &lt;target> ; &lt;base64-data> BEL
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
 */
import type { Writable } from "node:stream";

/**
 * Clipboard targets as defined by the OSC 52 spec.
 * - `c` — system clipboard
 * - `p` — primary selection (X11 only)
 * - `s` — secondary selection (X11 only)
 */
export type ClipboardTarget = "c" | "p" | "s";

const BEL = "\u0007";
const OSC = "\u001B]";

/**
 * Terminals known to support OSC 52 clipboard operations.
 */
const SUPPORTED_TERMINALS = new Set(["Alacritty", "contour", "foot", "Ghostty", "iTerm2", "iTerm.app", "kitty", "rio", "WezTerm"]);

/**
 * Check whether the current terminal likely supports OSC 52.
 *
 * Detection is best-effort based on `TERM_PROGRAM` and other env vars.
 * Returns `true` for known-supported terminals, `false` otherwise.
 */
export const isOsc52Supported = (): boolean => {
    const termProgram = process.env["TERM_PROGRAM"] ?? "";

    if (SUPPORTED_TERMINALS.has(termProgram)) {
        return true;
    }

    // xterm supports OSC 52 when allowWindowOps is enabled
    const term = process.env["TERM"] ?? "";

    if (term.startsWith("xterm")) {
        return true;
    }

    // Windows Terminal
    if (process.env["WT_SESSION"]) {
        return true;
    }

    // tmux — works if `set -s set-clipboard on`
    if (process.env["TMUX"]) {
        return true;
    }

    // screen — pass-through to host terminal
    if (term.startsWith("screen")) {
        return true;
    }

    return false;
};

/**
 * Write text to the system clipboard via OSC 52 escape sequence.
 * @param stream The writable stream (typically stdout) to write the escape sequence to.
 * @param text The text to copy to the clipboard.
 * @param target The clipboard target. Defaults to `"c"` (system clipboard).
 */
const VALID_TARGETS = new Set<string>(["c", "p", "s"]);

export const writeOsc52 = (stream: Writable, text: string, target: ClipboardTarget = "c"): void => {
    if (!VALID_TARGETS.has(target)) {
        throw new Error(`Invalid clipboard target: ${target}`);
    }

    const encoded = Buffer.from(text, "utf8").toString("base64");

    stream.write(`${OSC}52;${target};${encoded}${BEL}`);
};

/**
 * Clear the clipboard via OSC 52.
 * @param stream The writable stream to write the escape sequence to.
 * @param target The clipboard target. Defaults to `"c"`.
 */
export const clearOsc52 = (stream: Writable, target: ClipboardTarget = "c"): void => {
    stream.write(`${OSC}52;${target};${BEL}`);
};
