import { CSI } from "./constants";

/**
 * ANSI escape sequence to enable the alternative screen buffer.
 *
 * This sequence (`CSI ?1049h`) instructs the terminal to switch to the alternative screen buffer.
 * This is a common practice for full-screen terminal applications (e.g., vim, less, htop)
 * to provide a separate screen area for their interface, leaving the original shell content
 * undisturbed and restoring it upon exit.
 * When this mode is activated, the original screen content is typically saved by the terminal,
 * and a blank screen is presented. Operations then occur on this alternative buffer.
 *
 * The specific behavior (like whether the screen is cleared on switch) can sometimes vary
 * slightly between terminal emulators. `?1049h` generally includes saving the cursor position
 * along with the screen content and clearing the alternative screen.
 * It is closely related to mode `?47h`, which also switches to an alternative buffer but might
 * have different semantics regarding screen clearing and cursor saving.
 * Mode `?1049h` is generally preferred for a more robust alternative screen experience.
 * @see {@link ALT_SCREEN_OFF} for the sequence to disable the alternative screen buffer.
 * @see {@link alternativeScreenOn} for a function that returns this sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-The-Alternate-Screen-Buffer} Xterm Control Sequences documentation.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSLPP.html} (related DEC modes, though 1049 is more common for this behavior).
 */
export const ALT_SCREEN_ON: string = `${CSI}?1049h`;

/**
 * ANSI escape sequence to disable the alternative screen buffer.
 *
 * This sequence (`CSI ?1049l`) instructs the terminal to switch back from the alternative
 * screen buffer to the main screen buffer. When this occurs, the terminal typically
 * restores the screen content and cursor position that were saved when the alternative
 * buffer was activated by {@link ALT_SCREEN_ON}.
 *
 * This is used when a full-screen application exits, allowing the user to return to their
 * previous shell session seamlessly.
 * @see {@link ALT_SCREEN_ON} for the sequence to enable the alternative screen buffer.
 * @see {@link alternativeScreenOff} for a function that returns this sequence.
 */
export const ALT_SCREEN_OFF: string = `${CSI}?1049l`;

/**
 * Returns the ANSI escape sequence to enable the alternative screen buffer.
 *
 * This function is a convenience wrapper around the {@link ALT_SCREEN_ON} constant.
 * It provides a more descriptive way to obtain the sequence for enabling the
 * alternative screen, often used at the initialization phase of a full-screen
 * terminal application.
 * @returns The ANSI escape sequence (`CSI ?1049h`) for enabling the alternative screen buffer.
 * @example
 * ```typescript
 * import { alternativeScreenOn } from '@visulima/ansi/alternative-screen';
 *
 * process.stdout.write(alternativeScreenOn());
 * // Terminal switches to the alternative screen buffer.
 * ```
 * @see {@link ALT_SCREEN_ON}
 * @see {@link alternativeScreenOff}
 */
export const alternativeScreenOn = (): string => ALT_SCREEN_ON;

/**
 * Returns the ANSI escape sequence to disable the alternative screen buffer.
 *
 * This function is a convenience wrapper around the {@link ALT_SCREEN_OFF} constant.
 * It provides a more descriptive way to obtain the sequence for disabling the
 * alternative screen, typically used when a full-screen terminal application is exiting
 * to restore the user's original terminal state.
 * @returns The ANSI escape sequence (`CSI ?1049l`) for disabling the alternative screen buffer.
 * @example
 * ```typescript
 * import { alternativeScreenOff } from '@visulima/ansi/alternative-screen';
 *
 * process.stdout.write(alternativeScreenOff());
 * // Terminal switches back to the main screen buffer, restoring previous content.
 * ```
 * @see {@link ALT_SCREEN_OFF}
 * @see {@link alternativeScreenOn}
 */
export const alternativeScreenOff = (): string => ALT_SCREEN_OFF;
