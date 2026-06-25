import { BEL, OSC } from "./constants";

/** Strips OSC terminators (BEL, ESC) so caller-supplied colors cannot inject escape sequences. */
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
const COLOR_SANITIZE_REGEX = /[\u0007\u001B]/g;

const sanitizeColor = (color: string): string => color.replaceAll(COLOR_SANITIZE_REGEX, "");

/**
 * Returns a sequence that sets the terminal's default foreground (text) color.
 *
 * The color may be any string the terminal understands for `OSC 10`, such as an
 * X11 color name (`"red"`), a hex value (`"#ff0000"`), or an `XParseColor`
 * string (`"rgb:ff/00/00"`, `"rgba:ff/00/00/ff"`).
 *
 * Sequence: `OSC 10 ; color BEL`
 * @param color The color to set the foreground to.
 * @returns The `OSC 10` escape sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands}
 */
export const setForegroundColor = (color: string): string => `${OSC}10;${sanitizeColor(color)}${BEL}`;

/**
 * Sequence that queries the terminal's current default foreground color.
 *
 * Sequence: `OSC 10 ; ? BEL`
 */
export const requestForegroundColor: string = `${OSC}10;?${BEL}`;

/**
 * Sequence that resets the terminal's default foreground color to its default.
 *
 * Sequence: `OSC 110 BEL`
 */
export const resetForegroundColor: string = `${OSC}110${BEL}`;

/**
 * Returns a sequence that sets the terminal's default background color.
 *
 * The color may be any string the terminal understands for `OSC 11` (X11 color
 * name, hex value, or `XParseColor` string).
 *
 * Sequence: `OSC 11 ; color BEL`
 * @param color The color to set the background to.
 * @returns The `OSC 11` escape sequence.
 */
export const setBackgroundColor = (color: string): string => `${OSC}11;${sanitizeColor(color)}${BEL}`;

/**
 * Sequence that queries the terminal's current default background color.
 *
 * Sequence: `OSC 11 ; ? BEL`
 */
export const requestBackgroundColor: string = `${OSC}11;?${BEL}`;

/**
 * Sequence that resets the terminal's default background color to its default.
 *
 * Sequence: `OSC 111 BEL`
 */
export const resetBackgroundColor: string = `${OSC}111${BEL}`;

/**
 * Returns a sequence that sets the terminal's cursor color.
 *
 * The color may be any string the terminal understands for `OSC 12` (X11 color
 * name, hex value, or `XParseColor` string).
 *
 * Sequence: `OSC 12 ; color BEL`
 * @param color The color to set the cursor to.
 * @returns The `OSC 12` escape sequence.
 */
export const setCursorColor = (color: string): string => `${OSC}12;${sanitizeColor(color)}${BEL}`;

/**
 * Sequence that queries the terminal's current cursor color.
 *
 * Sequence: `OSC 12 ; ? BEL`
 */
export const requestCursorColor: string = `${OSC}12;?${BEL}`;

/**
 * Sequence that resets the terminal's cursor color to its default.
 *
 * Sequence: `OSC 112 BEL`
 */
export const resetCursorColor: string = `${OSC}112${BEL}`;
