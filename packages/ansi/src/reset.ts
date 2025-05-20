/**
 * The ANSI escape sequence for Reset Initial State (RIS).
 * This command attempts to reset the terminal to its power-up state or initial configuration.
 * The exact behavior can vary between terminal emulators, but it typically includes:
 * - Resetting graphic rendition (SGR parameters) to default.
 * - Clearing the screen.
 * - Moving the cursor to the top-left (home position).
 * - Resetting character sets.
 * - Resetting tab stops.
 * - Resetting modes (like DECAWM, DECOM) to their defaults.
 *
 * Sequence: `ESC c`
 *
 * This is a more comprehensive reset than `CSI 0 m` (which only resets SGR) or `CSI 2 J` (which only clears the screen).
 * It is often referred to as a "hard reset".
 *
 * @see {@link https://vt100.net/docs/vt510-rm/RIS.html VT510 RIS Documentation}
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Reset} Xterm Control Sequences - Reset
 */
export const RESET_INITIAL_STATE = "\u001Bc";

/**
 * Alias for {@link RESET_INITIAL_STATE} (Reset Initial State).
 *
 * Provides a shorter name for the RIS sequence `ESC c`.
 *
 * @see {@link RESET_INITIAL_STATE}
 */
export const RIS = RESET_INITIAL_STATE;
