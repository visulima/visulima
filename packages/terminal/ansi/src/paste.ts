import { CSI } from "./constants";

/**
 * Marker a terminal emits immediately before pasted text when bracketed paste
 * mode is enabled.
 *
 * Sequence: `CSI 200 ~`
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Bracketed-Paste-Mode}
 */
export const bracketedPasteStart: string = `${CSI}200~`;

/**
 * Marker a terminal emits immediately after pasted text when bracketed paste
 * mode is enabled.
 *
 * Sequence: `CSI 201 ~`
 */
export const bracketedPasteEnd: string = `${CSI}201~`;

/**
 * Wraps `text` in the bracketed-paste start/end markers, mirroring how a
 * terminal delivers pasted content to an application.
 * @param text The text to wrap.
 * @returns `text` surrounded by {@link bracketedPasteStart} and {@link bracketedPasteEnd}.
 */
export const wrapBracketedPaste = (text: string): string => `${bracketedPasteStart}${text}${bracketedPasteEnd}`;
