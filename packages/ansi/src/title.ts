import { BEL, OSC, ST } from "./constants";

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
export const setIconNameAndWindowTitle = (title: string): string => `${OSC}0;${title}${BEL}`;

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
export const setIconName = (iconName: string): string => `${OSC}1;${iconName}${BEL}`;

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
export const setWindowTitle = (title: string): string => `${OSC}2;${title}${BEL}`;

/**
 * Sets a DEC Special Window Title DECSWT using an OSC sequence.
 * This is a DEC-specific way to format window titles, often involving parameters.
 * The original Go library implemented this by prepending "1;" to the name and using `setWindowTitle`.
 *
 * Uses the sequence: `OSC 2 ; 1;&lt;name> BEL` (based on Go library's behavior)
 * @param name The name or content for the DEC-style window title.
 * @returns The ANSI escape sequence for DECSWT.
 * @see EK-VT520-RM 5–156 (VT520 Programmer Reference Manual)
 * @see setWindowTitle
 * @example
 * ```typescript
 * import { decswt } from "@visulima/ansi";
 *
 * process.stdout.write(decswt("My Special Title"));
 * // Sends: "\x1b]2;1;My Special Title\x07"
 * ```
 */
export const decswt = (name: string): string => setWindowTitle(`1;${name}`);

/**
 * Sets a DEC Special Icon Name (DECSIN) using an OSC sequence.
 * The original Go library implemented this by prepending "L;" to the name and using `setWindowTitle`,
 * resulting in an `OSC 2 ; L;&lt;name> BEL` sequence.
 * This differs from some interpretations where DECSIN might use `OSC L` or `OSC 1`.
 * This implementation replicates the Go library's specific behavior.
 *
 * Uses the sequence: `OSC 2 ; L;&lt;name> BEL` (based on Go library's behavior)
 * @param name The name or content for the DEC-style icon name.
 * @returns The ANSI escape sequence for DECSIN (as implemented).
 * @see EK-VT520-RM 5–134 (VT520 Programmer Reference Manual)
 * @see setWindowTitle
 * @example
 * ```typescript
 * import { decsin } from "@visulima/ansi";
 *
 * process.stdout.write(decsin("SpecialIcon"));
 * // Sends: "\x1b]2;L;SpecialIcon\x07"
 * ```
 */
export const decsin = (name: string): string => setWindowTitle(`L;${name}`);

// Alternative versions using ST as terminator for completeness, though Go uses BEL.

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
export const setIconNameAndWindowTitleWithST = (title: string): string => `${OSC}0;${title}${ST}`;

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
export const setIconNameWithST = (iconName: string): string => `${OSC}1;${iconName}${ST}`;

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
export const setWindowTitleWithST = (title: string): string => `${OSC}2;${title}${ST}`;
