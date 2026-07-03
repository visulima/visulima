import { ESC } from "./constants";

/**
 * Keypad Application Mode (DECKPAM).
 *
 * Switches the numeric keypad into "application" mode, so its keys transmit
 * application control sequences instead of the plain numeric/cursor characters.
 * This is equivalent to setting the DEC private mode DECNKM.
 *
 * Sequence: `ESC =`
 * @see {@link https://vt100.net/docs/vt510-rm/DECKPAM.html}
 */
export const keypadApplicationMode: string = `${ESC}=`;

/** Alias for {@link keypadApplicationMode} (DEC Keypad Application Mode). */
export const DECKPAM: string = keypadApplicationMode;

/**
 * Keypad Numeric Mode (DECKPNM).
 *
 * Switches the numeric keypad back into "numeric" mode, so its keys transmit the
 * plain numeric/cursor characters. This is equivalent to resetting the DEC
 * private mode DECNKM.
 *
 * Sequence: `ESC >`
 * @see {@link https://vt100.net/docs/vt510-rm/DECKPNM.html}
 */
export const keypadNumericMode: string = `${ESC}>`;

/** Alias for {@link keypadNumericMode} (DEC Keypad Numeric Mode). */
export const DECKPNM: string = keypadNumericMode;
