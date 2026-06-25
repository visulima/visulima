/** Escape character (\u001B). */
export const ESC: string = "\u001B";

/** Control Sequence Introducer (ESC [). */
export const CSI: string = `${ESC}[`;

/** Operating System Command (ESC ]). */
export const OSC: string = "\u001B]";

/** Bell character (\u0007). Often used to terminate OSC sequences. */
export const BEL: string = "\u0007";

/** Separator used in some ANSI sequences, typically a semicolon. */
export const SEP: string = ";";

/** Device Control String (ESC P). */
export const DCS: string = `${ESC}P`;

/** String Terminator (ESC \\). Used to terminate DCS, SOS, PM, APC sequences. */
export const ST: string = `${ESC}\\`;

/** Application Program Command (ESC _). */
export const APC: string = `${ESC}_`;

/** Start of String (ESC X). */
export const SOS: string = `${ESC}X`;

/** Privacy Message (ESC ^). */
export const PM: string = `${ESC}^`;

/**
 * Strips OSC terminators (BEL, ESC) from a caller-supplied value so it cannot
 * inject or prematurely terminate an escape sequence when interpolated into one.
 * @param value The untrusted string to sanitize.
 * @returns `value` with all BEL and ESC characters removed.
 */
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
export const stripOscTerminators = (value: string): string => value.replaceAll(/[\u0007\u001B]/g, "");
