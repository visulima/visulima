/* eslint-disable no-secrets/no-secrets */
import { BEL, OSC, ST, stripOscTerminators } from "./constants";

/**
 * Sanitizes a title string for use in OSC sequences. BEL (U+0007) and ESC
 * (U+001B) can terminate an OSC payload early — left intact, an
 * attacker-controlled title could close the title-set sequence and inject
 * a follow-up OSC (clipboard write, palette change, …). Stripping both
 * bytes is the cheapest portable defense.
 * @param title The title string to validate
 * @returns The sanitized title string
 */
const validateTitle = (title: string): string => {
    if (typeof title !== "string") {
        throw new TypeError("Title must be a string");
    }

    return stripOscTerminators(title);
};

/**
 * Sets the icon name and window title using an OSC (Operating System Command) sequence.
 * This typically affects the title shown in the window's title bar and the name used for the icon
 * when the window is minimized or in a taskbar.
 *
 * Uses the sequence: `OSC 0 ; title BEL`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `0`: Parameter indicating to set both icon name and window title.
 * - `title`: The string to set.
 * - `BEL`: Bell character (`\x07`) as terminator.
 * @param title The string to be set as both the icon name and the window title.
 * @returns The ANSI escape sequence for setting the icon name and window title.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setIconNameAndWindowTitle } from "@visulima/ansi";
 *
 * process.stdout.write(setIconNameAndWindowTitle("My Application"));
 * // Sends: "\x1b]0;My Application\x07"
 * ```
 */
export const setIconNameAndWindowTitle = (title: string): string => `${OSC}0;${validateTitle(title)}${BEL}`;

/**
 * Sets the icon name using an OSC (Operating System Command) sequence.
 * This affects the name used for the icon when the window is minimized or in a taskbar.
 *
 * Uses the sequence: `OSC 1 ; iconName BEL`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `1`: Parameter indicating to set only the icon name.
 * - `iconName`: The string to set as the icon name.
 * - `BEL`: Bell character (`\x07`) as terminator.
 * @param iconName The string to be set as the icon name.
 * @returns The ANSI escape sequence for setting the icon name.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setIconName } from "@visulima/ansi";
 *
 * process.stdout.write(setIconName("AppIcon"));
 * // Sends: "\x1b]1;AppIcon\x07"
 * ```
 */
export const setIconName = (iconName: string): string => `${OSC}1;${validateTitle(iconName)}${BEL}`;

/**
 * Sets the window title using an OSC (Operating System Command) sequence.
 * This affects the title shown in the window's title bar.
 *
 * Uses the sequence: `OSC 2 ; title BEL`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `2`: Parameter indicating to set only the window title.
 * - `title`: The string to set as the window title.
 * - `BEL`: Bell character (`\x07`) as terminator.
 * @param title The string to be set as the window title.
 * @returns The ANSI escape sequence for setting the window title.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setWindowTitle } from "@visulima/ansi";
 *
 * process.stdout.write(setWindowTitle("Current Document - Editor"));
 * // Sends: "\x1b]2;Current Document - Editor\x07"
 * ```
 */
export const setWindowTitle = (title: string): string => `${OSC}2;${validateTitle(title)}${BEL}`;

/**
 * Sets a DEC Special Window Title (DECSWT) using an OSC sequence.
 *
 * DECSWT was introduced in the DEC VT520/VT525 family and uses the dedicated
 * OSC code `21` (not to be confused with OSC 2 for standard window titles).
 * It is terminated with ST (String Terminator) per the VT520 specification.
 *
 * Uses the sequence: `OSC 21 ; title ST`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `21`: Parameter for DEC Special Window Title.
 * - `title`: The string to set.
 * - `ST`: String Terminator (`\x1b\\`).
 *
 * Support varies across modern emulators; Zutty 0.6+ claims VT520 compatibility,
 * and Microsoft's Windows Terminal also supports this sequence.
 * Unsupported sequences are typically silently ignored by most terminals.
 * @param title The title string.
 * @returns The ANSI escape sequence for DECSWT.
 * @see EK-VT520-RM 5–134 (VT520 Programmer Reference Manual)
 * @example
 * ```typescript
 * import { decswt } from "@visulima/ansi";
 *
 * process.stdout.write(decswt("My Special Window"));
 * // Sends: "\x1b]21;My Special Window\x1b\\"
 * ```
 */
export const decswt = (title: string): string => `${OSC}21;${validateTitle(title)}${ST}`;

/**
 * Sets a DEC Special Icon Name (DECSIN) using an OSC sequence.
 *
 * DECSIN was introduced in the DEC VT520/VT525 family and uses the dedicated
 * OSC code `2L` (not to be confused with OSC 1 for standard icon names).
 * It is terminated with ST (String Terminator) per the VT520 specification.
 *
 * Uses the sequence: `OSC 2L ; name ST`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `2L`: Parameter for DEC Special Icon Name.
 * - `name`: The string to set.
 * - `ST`: String Terminator (`\x1b\\`).
 *
 * Support varies across modern emulators; Zutty 0.6+ claims VT520 compatibility,
 * and Microsoft's Windows Terminal also supports this sequence.
 * Unsupported sequences are typically silently ignored by most terminals.
 * @param name The name or content for the DEC-style icon name.
 * @returns The ANSI escape sequence for DECSIN.
 * @see EK-VT520-RM 5–134 (VT520 Programmer Reference Manual)
 * @example
 * ```typescript
 * import { decsin } from "@visulima/ansi";
 *
 * process.stdout.write(decsin("SpecialIcon"));
 * // Sends: "\x1b]2L;SpecialIcon\x1b\\"
 * ```
 */
export const decsin = (name: string): string => `${OSC}2L;${validateTitle(name)}${ST}`;

/**
 * Sets the icon name and window title using an OSC sequence, terminated with ST (String Terminator).
 * This is an alternative to the BEL-terminated version.
 *
 * Uses the sequence: `OSC 0 ; title ST`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `0`: Parameter indicating to set both icon name and window title.
 * - `title`: The string to set.
 * - `ST`: String Terminator (`\x1b\\`).
 * @param title The string to be set as both the icon name and the window title.
 * @returns The ANSI escape sequence for setting the icon name and window title, using ST.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setIconNameAndWindowTitleWithST } from "@visulima/ansi";
 *
 * process.stdout.write(setIconNameAndWindowTitleWithST("My App ST"));
 * // Sends: "\x1b]0;My App ST\x1b\\"
 * ```
 */
export const setIconNameAndWindowTitleWithST = (title: string): string => `${OSC}0;${validateTitle(title)}${ST}`;

/**
 * Sets the icon name using an OSC sequence, terminated with ST (String Terminator).
 * This is an alternative to the BEL-terminated version.
 *
 * Uses the sequence: `OSC 1 ; iconName ST`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `1`: Parameter indicating to set only the icon name.
 * - `iconName`: The string to set as the icon name.
 * - `ST`: String Terminator (`\x1b\\`).
 * @param iconName The string to be set as the icon name.
 * @returns The ANSI escape sequence for setting the icon name, using ST.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setIconNameWithST } from "@visulima/ansi";
 *
 * process.stdout.write(setIconNameWithST("AppIcon ST"));
 * // Sends: "\x1b]1;AppIcon ST\x1b\\"
 * ```
 */
export const setIconNameWithST = (iconName: string): string => `${OSC}1;${validateTitle(iconName)}${ST}`;

/**
 * Sets the window title using an OSC sequence, terminated with ST (String Terminator).
 * This is an alternative to the BEL-terminated version.
 *
 * Uses the sequence: `OSC 2 ; title ST`
 * - `OSC`: Operating System Command (`\x1b]`).
 * - `2`: Parameter indicating to set only the window title.
 * - `title`: The string to set as the window title.
 * - `ST`: String Terminator (`\x1b\\`).
 * @param title The string to be set as the window title.
 * @returns The ANSI escape sequence for setting the window title, using ST.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Operating-System-Commands Xterm OSC documentation}
 * @example
 * ```typescript
 * import { setWindowTitleWithST } from "@visulima/ansi";
 *
 * process.stdout.write(setWindowTitleWithST("Document ST - Editor"));
 * // Sends: "\x1b]2;Document ST - Editor\x1b\\"
 * ```
 */
export const setWindowTitleWithST = (title: string): string => `${OSC}2;${validateTitle(title)}${ST}`;
