import { BEL, OSC } from "./constants";

/** Strips OSC terminators (BEL, ESC) so caller-supplied values cannot inject escape sequences. */
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
const sanitize = (value: string): string => value.replaceAll(/[\u0007\u001B]/g, "");

/**
 * Returns a urxvt (rxvt-unicode) extension sequence (`OSC 777`).
 *
 * urxvt exposes Perl extensions through `OSC 777`, where the first parameter is
 * the extension name followed by its arguments, e.g.
 * `urxvtExtension("notify", "title", "body")`.
 *
 * Sequence: `OSC 777 ; extension ; param1 ; param2 ; … BEL`
 * @param extension The extension name to invoke.
 * @param parameters The extension parameters, joined with `;`.
 * @returns The `OSC 777` escape sequence.
 * @see {@link https://man.archlinux.org/man/urxvt.7}
 */
const urxvtExtension = (extension: string, ...parameters: string[]): string =>
    `${OSC}777;${sanitize(extension)};${parameters.map((value) => sanitize(value)).join(";")}${BEL}`;

export default urxvtExtension;
