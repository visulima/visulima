import { CSI } from "./constants";

/**
 * Scrolls the content of the active scrolling region upwards by a specified number of lines.
 * (SU - Scroll Up)
 *
 * New blank lines are added at the bottom of the scrolling region.
 * If the parameter `count` is 1 or omitted, it defaults to scrolling one line.
 * The cursor position is not affected by this command.
 *
 * Sequence: `CSI Pn S`
 * - `Pn`: Number of lines to scroll up (default: 1).
 * @param count The number of lines to scroll up. Defaults to 1. If 0, an empty string is returned as no operation is performed.
 * @returns The ANSI escape sequence for scrolling up.
 * @see {@link https://vt100.net/docs/vt510-rm/SU.html VT510 SU Documentation}
 * @example
 * ```typescript
 * import { scrollUp } from \'@visulima/ansi/scroll\';
 *
 * // Scroll up 1 line
 * process.stdout.write(scrollUp());    // CSI S
 * process.stdout.write(scrollUp(1)); // CSI S
 *
 * // Scroll up 5 lines
 * process.stdout.write(scrollUp(5));  // CSI 5S
 *
 * // No operation
 * process.stdout.write(scrollUp(0));  // ""
 * ```
 */
export const scrollUp = (count = 1): string => {
    if (count === 0) {
        return "";
    }

    // Standard is CSI Pn S. Omitting Pn or Pn=1 implies 1.
    return `${CSI + (count <= 1 ? "" : count)}S`;
};

/**
 * Scrolls the content of the active scrolling region downwards by a specified number of lines.
 * (SD - Scroll Down)
 *
 * New blank lines are added at the top of the scrolling region.
 * If the parameter `count` is 1 or omitted, it defaults to scrolling one line.
 * The cursor position is not affected by this command.
 *
 * Sequence: `CSI Pn T`
 * - `Pn`: Number of lines to scroll down (default: 1).
 * @param count The number of lines to scroll down. Defaults to 1. If 0, an empty string is returned.
 * @returns The ANSI escape sequence for scrolling down.
 * @see {@link https://vt100.net/docs/vt510-rm/SD.html VT510 SD Documentation}
 * @example
 * ```typescript
 * import { scrollDown } from \'@visulima/ansi/scroll\';
 *
 * // Scroll down 1 line
 * process.stdout.write(scrollDown());    // CSI T
 * process.stdout.write(scrollDown(1)); // CSI T
 *
 * // Scroll down 3 lines
 * process.stdout.write(scrollDown(3));  // CSI 3T
 * ```
 */
export const scrollDown = (count = 1): string => {
    if (count === 0) {
        return "";
    }

    // Standard is CSI Pn T. Omitting Pn or Pn=1 implies 1.
    return `${CSI + (count <= 1 ? "" : count)}T`;
};

/**
 * ANSI escape sequence to scroll up one line: `CSI S`.
 * This is equivalent to `scrollUp(1)`.
 * @see {@link scrollUp}
 */
export const SCROLL_UP_1: string = `${CSI}S`;

/**
 * ANSI escape sequence to scroll down one line: `CSI T`.
 * This is equivalent to `scrollDown(1)`.
 * @see {@link scrollDown}
 */
export const SCROLL_DOWN_1: string = `${CSI}T`;
