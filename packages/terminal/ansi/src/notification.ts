import { BEL, OSC, stripOscTerminators } from "./constants";

/**
 * Returns a sequence that triggers a desktop notification using the simple
 * `OSC 9` protocol popularised by iTerm2.
 *
 * Sequence: `OSC 9 ; Mc BEL`
 * @param message The notification body.
 * @returns The `OSC 9` escape sequence.
 * @example
 * ```typescript
 * import { notify } from "@visulima/ansi/notification";
 *
 * process.stdout.write(notify("Build finished"));
 * ```
 * @see {@link https://iterm2.com/documentation-escape-codes.html}
 */
export const notify = (message: string): string => `${OSC}9;${stripOscTerminators(message)}${BEL}`;

/**
 * Returns a sequence for the extensible `OSC 99` desktop notification protocol.
 *
 * `OSC 99` supports optional metadata (colon-separated `key=value` pairs, e.g.
 * `"i=1"`, `"d=1"`, `"p=title"`) followed by the payload body.
 *
 * Sequence: `OSC 99 ; metadata ; payload BEL`
 * @param payload The notification body.
 * @param metadata Optional metadata entries, joined with `:`.
 * @returns The `OSC 99` escape sequence.
 * @see {@link https://sw.kovidgoyal.net/kitty/desktop-notifications/}
 */
export const desktopNotification = (payload: string, ...metadata: string[]): string =>
    // The empty metadata segment (leading `;`) when no metadata is supplied is intentional per the OSC 99 grammar.
    `${OSC}99;${metadata.map((value) => stripOscTerminators(value)).join(":")};${stripOscTerminators(payload)}${BEL}`;
