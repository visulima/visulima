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
