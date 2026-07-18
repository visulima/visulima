import { BEL, OSC, ST } from "./constants";
import { encodeBase64String } from "./utils/base64";

/**
 * Selection targets for OSC 52 clipboard operations.
 *
 * - `c` is the system clipboard (the common default).
 * - `p` is the primary selection (X11 middle-click paste buffer).
 * - `q` is the secondary selection.
 * - `s` is the "select" selection.
 * - `0` to `7` are numbered cut buffers.
 *
 * Multiple targets may be combined (e.g. `"cp"`) to write the same data to
 * several selections at once.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html}
 */
export type ClipboardSelection = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "c" | "p" | "q" | "s" | (string & {});

/**
 * Writes data to the terminal's clipboard using the OSC 52 escape sequence.
 *
 * Sequence: `OSC 52 ; selection ; base64-data ST`
 *
 * OSC 52 is the only clipboard mechanism that works over SSH/tmux, because the
 * write travels in-band over the terminal stream rather than touching a local
 * clipboard API. The terminal emulator must have clipboard writes enabled
 * (e.g. `set-clipboard` in xterm, `allow-passthrough` plus `set-clipboard` in
 * tmux); many enable it by default.
 * @param data The text to place on the clipboard.
 * @param selection The selection target(s). Defaults to `"c"` (system clipboard).
 * @param terminator The OSC terminator to use. Defaults to {@link BEL}; pass
 * {@link ST} (`ESC backslash`) for terminals that require the canonical String Terminator.
 * @returns The OSC 52 escape sequence.
 * @example
 * ```typescript
 * import { setClipboard } from "@visulima/ansi/clipboard";
 *
 * // Copy a generated token to the user's local clipboard from a remote shell.
 * process.stdout.write(setClipboard("my-secret-token"));
 * ```
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html}
 */
export const setClipboard = (data: string, selection: ClipboardSelection = "c", terminator: string = BEL): string =>
    `${OSC}52;${selection};${encodeBase64String(data)}${terminator}`;

/**
 * Requests the current contents of the terminal's clipboard via OSC 52.
 *
 * Sequence: `OSC 52 ; selection ; ? ST`
 *
 * The terminal responds with `OSC 52 ; selection ; base64-data ST` if it
 * permits clipboard reads (frequently disabled for security). Decode the
 * Base64 payload from the response to obtain the clipboard text.
 * @param selection The selection target to query. Defaults to `"c"` (system clipboard).
 * @param terminator The OSC terminator to use. Defaults to {@link BEL}; pass {@link ST} for terminals that require it.
 * @returns The OSC 52 query escape sequence.
 * @example
 * ```typescript
 * import { requestClipboard } from "@visulima/ansi/clipboard";
 *
 * process.stdout.write(requestClipboard());
 * ```
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html}
 */
export const requestClipboard = (selection: ClipboardSelection = "c", terminator: string = BEL): string => `${OSC}52;${selection};?${terminator}`;

/**
 * Clears the terminal's clipboard for the given selection via OSC 52.
 *
 * Sequence: `OSC 52 ; selection ; ST` (an empty payload clears the selection).
 * @param selection The selection target to clear. Defaults to `"c"` (system clipboard).
 * @param terminator The OSC terminator to use. Defaults to {@link BEL}; pass {@link ST} for terminals that require it.
 * @returns The OSC 52 clear escape sequence.
 * @example
 * ```typescript
 * import { clearClipboard } from "@visulima/ansi/clipboard";
 *
 * process.stdout.write(clearClipboard());
 * ```
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html}
 */
export const clearClipboard = (selection: ClipboardSelection = "c", terminator: string = BEL): string => `${OSC}52;${selection};${terminator}`;
