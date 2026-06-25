import { CSI } from "./constants";

/**
 * Event a terminal emits when the window gains focus, while focus event
 * reporting is enabled (DEC private mode 1004).
 *
 * Sequence: `CSI I`
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Focus-Tracking}
 */
export const FOCUS: string = `${CSI}I`;

/**
 * Event a terminal emits when the window loses focus, while focus event
 * reporting is enabled (DEC private mode 1004).
 *
 * Sequence: `CSI O`
 */
export const BLUR: string = `${CSI}O`;

/** Alias for {@link FOCUS}. */
export const focusInEvent: string = FOCUS;

/** Alias for {@link BLUR}. */
export const focusOutEvent: string = BLUR;
