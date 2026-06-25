import { ESC } from "./constants";

/**
 * Returns a Select Character Set (SCS) sequence that designates `charset` into
 * one of the G0–G3 character-set slots.
 *
 * `gset` is one of the designator characters (see {@link G0}, {@link G1},
 * {@link G2}, {@link G3} for 94-character sets, or `"-"`, `"."`, `"/"` for the
 * 96-character G1–G3 slots). `charset` selects the final character of the set,
 * e.g. {@link USASCII} (`"B"`), {@link DEC_SPECIAL_GRAPHICS} (`"0"`) or
 * {@link UNITED_KINGDOM} (`"A"`).
 *
 * Sequence: `ESC gset charset`
 * @param gset The G-set designator character.
 * @param charset The final character identifying the character set.
 * @returns The SCS escape sequence.
 * @see {@link https://vt100.net/docs/vt510-rm/SCS.html}
 */
export const selectCharacterSet = (gset: string, charset: string): string => `${ESC}${gset}${charset}`;

/** Alias for {@link selectCharacterSet} (Select Character Set). */
export const SCS: (gset: string, charset: string) => string = selectCharacterSet;

/** G0 designator for a 94-character set. */
export const G0: string = "(";

/** G1 designator for a 94-character set. */
export const G1: string = ")";

/** G2 designator for a 94-character set. */
export const G2: string = "*";

/** G3 designator for a 94-character set. */
export const G3: string = "+";

/** DEC Special Character and Line Drawing Set (final character `0`). */
export const DEC_SPECIAL_GRAPHICS: string = "0";

/** United Kingdom character set (final character `A`). */
export const UNITED_KINGDOM: string = "A";

/** United States (USASCII) character set (final character `B`). */
export const USASCII: string = "B";

/** Locking Shift 0 (LS0 / SI): invoke G0 into GL. Sequence: `SI` (`\u000F`). */
export const LS0: string = "\u000F";

/** Alias for {@link LS0} (Shift In). */
export const SI: string = LS0;

/** Locking Shift 1 (LS1 / SO): invoke G1 into GL. Sequence: `SO` (`\u000E`). */
export const LS1: string = "\u000E";

/** Alias for {@link LS1} (Shift Out). */
export const SO: string = LS1;

/** Locking Shift 1 Right (LS1R): invoke G1 into GR. Sequence: `ESC ~`. */
export const LS1R: string = `${ESC}~`;

/** Locking Shift 2 (LS2): invoke G2 into GL. Sequence: `ESC n`. */
export const LS2: string = `${ESC}n`;

/** Locking Shift 2 Right (LS2R): invoke G2 into GR. Sequence: `ESC }`. */
export const LS2R: string = `${ESC}}`;

/** Locking Shift 3 (LS3): invoke G3 into GL. Sequence: `ESC o`. */
export const LS3: string = `${ESC}o`;

/** Locking Shift 3 Right (LS3R): invoke G3 into GR. Sequence: `ESC |`. */
export const LS3R: string = `${ESC}|`;
