/** Escape character (\u001B). */
export const ESC = "\u001B";

/** Control Sequence Introducer (ESC [). */
export const CSI = `${ESC}[`;

/** Operating System Command (ESC ]). */
export const OSC = "\u001B]";

/** Bell character (\u0007). Often used to terminate OSC sequences. */
export const BEL = "\u0007";

/** Separator used in some ANSI sequences, typically a semicolon. */
export const SEP = ";";

/** Device Control String (ESC P). */
export const DCS = `${ESC}P`;

/** String Terminator (ESC \\). Used to terminate DCS, SOS, PM, APC sequences. */
export const ST = `${ESC}\\`;

/** Application Program Command (ESC _). */
export const APC = `${ESC}_`;

/** Start of String (ESC X). */
export const SOS = `${ESC}X`;

/** Privacy Message (ESC ^). */
export const PM = `${ESC}^`;
