/* eslint-disable no-secrets/no-secrets */
import { CSI, SEP } from "./constants";

/**
 * Enum for XTerm Window Operations (XTWINOPS).
 * These are parameters for the `CSI Ps ; Ps ; Ps t` sequence.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h4-Functions-using-CSI-_-ordered-by-the-final-character-lparen-s-rparen:CSI-Ps;Ps;Ps-t.1EB0}
 */
export enum XTermWindowOp {
    /**
     * De-iconify window.
     */
    DEICONIFY_WINDOW = 1,

    /**
     * Iconify window.
     */
    ICONIFY_WINDOW = 2,

    /**
     * Lower the window to the bottom of the stacking order.
     */
    LOWER_WINDOW = 6,

    /**
     * Maximize window (i.e., "zoom" or "toggle").
     */
    MAXIMIZE_WINDOW = 10,

    /**
     * Maximize window horizontally.
     */
    MAXIMIZE_WINDOW_HORIZONTALLY = 10.2,

    /**
     * Maximize window vertically.
     */
    MAXIMIZE_WINDOW_VERTICALLY = 10.1,

    /**
     * Move window to `[x, y]`.
     */
    MOVE_WINDOW = 3,

    /**
     * Pop window title from stack.
     */
    POP_WINDOW_TITLE = 23,

    /**
     * Push window title on stack.
     */
    PUSH_WINDOW_TITLE = 22,

    /**
     * Raise the window to the front of the stacking order.
     */
    RAISE_WINDOW = 5,

    /**
     * Refresh the window.
     */
    REFRESH_WINDOW = 7,

    /**
     * Report cell size in pixels.
     * Response: `CSI 6 ; height ; width t`
     */
    REPORT_CELL_SIZE_PIXELS = 16, // From Go code

    /**
     * Report icon label.
     * Response: `OSC L label ST`
     */
    REPORT_ICON_LABEL = 19,

    /**
     * Report text area size in characters.
     * Response: `CSI 4 ; height ; width t`
     */
    REPORT_TEXT_AREA_SIZE_CHARS = 14,

    /**
     * Report text area size in pixels.
     * Response: `CSI 8 ; height ; width t`
     */
    REPORT_TEXT_AREA_SIZE_PIXELS = 18,

    /**
     * Report window position.
     * Response: `CSI 3 ; x ; y t`
     */
    REPORT_WINDOW_POSITION = 13,

    /**
     * Report window state.
     * Response: `CSI code t` where `code` is 1 if de-iconified, 2 if iconified.
     */
    REPORT_WINDOW_STATE = 11,

    /**
     * Report window title.
     * Response: `OSC l label ST`
     */
    REPORT_WINDOW_TITLE = 21,

    /**
     * Report window size in pixels.
     * Alias for `REPORT_TEXT_AREA_SIZE_PIXELS` for compatibility with some terminals (e.g., mintty).
     * Response: `CSI 4 ; height ; width t`
     * Should be REPORT_TEXT_AREA_SIZE_PIXELS (18) for XTerm, but using Go's value.
     */
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
    REQUEST_WINDOW_SIZE_WIN_OP_COMPAT = 14, // From Go code

    /**
     * Resize the screen to `[width, height]` in pixels and resize the text area to `[cols, lines]` in characters.
     * (DECSLPP - Set Lines Per Page)
     */
    RESIZE_SCREEN_AND_TEXT_AREA = 24, // Typically with one param (lines), but XTerm extends it for width/height too

    /**
     * Resize the text area to `[height, width]` in characters.
     */
    RESIZE_TEXT_AREA_CHARS = 4,

    /**
     * Resize the text area to `[height, width]` in pixels.
     */
    RESIZE_TEXT_AREA_PIXELS = 8,

    /**
     * Restore maximized window.
     */
    RESTORE_MAXIMIZED_WINDOW = 9,

    /**
     * Undo full-screen mode.
     */
    UNDO_FULL_SCREEN_MODE = 10.3, // Note: XTerm docs list 10 ; 0, 10 ; 1, 10 ; 2, this is simplified.
}

/**
 * Generates an XTerm Window Operation (XTWINOPS) sequence.
 *
 * `CSI Ps ; Ps ; Ps t`
 * @param p The primary parameter, typically one of {@link XTermWindowOp}.
 * @param ps Additional parameters.
 * @returns The ANSI sequence string, or an empty string if `p` is invalid.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h4-Functions-using-CSI-_-ordered-by-the-final-character-lparen-s-rparen:CSI-Ps;Ps;Ps-t.1EB0}
 */
export const xtermWindowOp: (p: number, ...ps: number[]) => string = (p: number, ...ps: number[]): string => {
    const allowedFloats = [XTermWindowOp.MAXIMIZE_WINDOW_VERTICALLY, XTermWindowOp.MAXIMIZE_WINDOW_HORIZONTALLY, XTermWindowOp.UNDO_FULL_SCREEN_MODE];

    if (allowedFloats.includes(p)) {
        // Allow specific float values
    } else if (p <= 0) {
        // Disallow zero or negative integers that are not allowed floats
        return "";
    }
    // For positive integers or allowed floats, proceed

    const parameters: (number | string)[] = [p];

    for (const value of ps) {
        if (value >= 0) {
            parameters.push(value);
        }
    }

    return `${CSI}${parameters.join(";")}t`;
}

/**
 * Alias for {@link xtermWindowOp}.
 */
export const XTWINOPS: (p: number, ...ps: number[]) => string = xtermWindowOp;

// Helper functions based on Go code constants

/**
 * Resizes the terminal window's text area to a specified height and width in characters.
 * This effectively sets the number of rows and columns for text display.
 *
 * Sequence: `CSI 4 ; height ; width t`
 * @param height The desired height in characters (number of rows).
 * @param width The desired width in characters (number of columns).
 * @returns The ANSI escape sequence to resize the text area.
 * @see xtermWindowOp
 * @see XTermWindowOp.RESIZE_TEXT_AREA_CHARS
 * @example
 * ```typescript
 * import { resizeTextAreaChars } from "@visulima/ansi";
 *
 * // Resize to 24 rows, 80 columns
 * process.stdout.write(resizeTextAreaChars(24, 80));
 * // Sends: "\x1b[4;24;80t"
 * ```
 */
export const resizeTextAreaChars = (height: number, width: number): string => xtermWindowOp(XTermWindowOp.RESIZE_TEXT_AREA_CHARS, height, width);

/**
 * Requests a report of the terminal window's text area size in characters (rows and columns).
 * The terminal is expected to respond with a sequence like `CSI 4 ; height ; width t`.
 *
 * This function uses `XTermWindowOp.REQUEST_WINDOW_SIZE_WIN_OP_COMPAT` (14), which corresponds to
 * `XTermWindowOp.REPORT_TEXT_AREA_SIZE_CHARS` in XTerm.
 *
 * Sequence: `CSI 14 t` (which triggers the report `CSI 4 ; height ; width t`)
 * @returns The ANSI escape sequence to request the text area size in characters.
 * @see xtermWindowOp
 * @see XTermWindowOp.REPORT_TEXT_AREA_SIZE_CHARS
 * @see XTermWindowOp.REQUEST_WINDOW_SIZE_WIN_OP_COMPAT
 * @example
 * ```typescript
 * import { requestTextAreaSizeChars } from "@visulima/ansi";
 *
 * process.stdout.write(requestTextAreaSizeChars());
 * // Sends: "\x1b[14t"
 * // Expect response like: "\x1b[4;24;80t" if terminal is 24x80
 * ```
 */
export const requestTextAreaSizeChars = (): string => xtermWindowOp(XTermWindowOp.REQUEST_WINDOW_SIZE_WIN_OP_COMPAT) // This is 14, same as REPORT_TEXT_AREA_SIZE_CHARS
;

/**
 * Requests a report of the terminal's character cell size in pixels.
 * The terminal is expected to respond with a sequence like `CSI 6 ; height ; width t`,
 * where height and width are the dimensions of a single character cell in pixels.
 *
 * Sequence: `CSI 16 t` (which triggers the report `CSI 6 ; height ; width t`)
 * @returns The ANSI escape sequence to request the cell size in pixels.
 * @see xtermWindowOp
 * @see XTermWindowOp.REPORT_CELL_SIZE_PIXELS
 * @example
 * ```typescript
 * import { requestCellSizePixels } from "@visulima/ansi";
 *
 * process.stdout.write(requestCellSizePixels());
 * // Sends: "\x1b[16t"
 * // Expect response like: "\x1b[6;15;8t" if cell size is 15px height, 8px width
 * ```
 */
export const requestCellSizePixels = (): string => xtermWindowOp(XTermWindowOp.REPORT_CELL_SIZE_PIXELS);

/**
 * Requests a report of the terminal window's text area size in pixels.
 * The terminal is expected to respond with a sequence like `CSI 8 ; height ; width t`.
 *
 * Sequence: `CSI 18 t` (which triggers the report `CSI 8 ; height ; width t`)
 * @returns The ANSI escape sequence to request the text area size in pixels.
 * @see xtermWindowOp
 * @see XTermWindowOp.REPORT_TEXT_AREA_SIZE_PIXELS
 * @example
 * ```typescript
 * import { requestTextAreaSizePixels } from "@visulima/ansi";
 *
 * process.stdout.write(requestTextAreaSizePixels());
 * // Sends: "\x1b[18t"
 * // Expect response like: "\x1b[8;600;800t" if text area is 600px height, 800px width
 * ```
 */
export const requestTextAreaSizePixels = (): string => xtermWindowOp(XTermWindowOp.REPORT_TEXT_AREA_SIZE_PIXELS);

/**
 * De-iconifies the terminal window (restores it if minimized).
 *
 * Sequence: `CSI 1 t`
 * @returns The ANSI escape sequence to de-iconify the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.DEICONIFY_WINDOW
 * @example
 * ```typescript
 * import { deiconifyWindow } from "@visulima/ansi";
 *
 * process.stdout.write(deiconifyWindow()); // Sends: "\x1b[1t"
 * ```
 */
export const deiconifyWindow = (): string => xtermWindowOp(XTermWindowOp.DEICONIFY_WINDOW);

/**
 * Iconifies the terminal window (minimizes it).
 *
 * Sequence: `CSI 2 t`
 * @returns The ANSI escape sequence to iconify the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.ICONIFY_WINDOW
 * @example
 * ```typescript
 * import { iconifyWindow } from "@visulima/ansi";
 *
 * process.stdout.write(iconifyWindow()); // Sends: "\x1b[2t"
 * ```
 */
export const iconifyWindow = (): string => xtermWindowOp(XTermWindowOp.ICONIFY_WINDOW);

/**
 * Moves the terminal window to the specified screen coordinates (top-left corner).
 *
 * Sequence: `CSI 3 ; x ; y t`
 * - `x`: The X-coordinate (horizontal position in pixels from the left edge).
 * - `y`: The Y-coordinate (vertical position in pixels from the top edge).
 * @param x The target X-coordinate for the window's top-left corner.
 * @param y The target Y-coordinate for the window's top-left corner.
 * @returns The ANSI escape sequence to move the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.MOVE_WINDOW
 * @example
 * ```typescript
 * import { moveWindow } from "@visulima/ansi";
 *
 * // Move window to X=100, Y=50
 * process.stdout.write(moveWindow(100, 50)); // Sends: "\x1b[3;100;50t"
 * ```
 */
export const moveWindow = (x: number, y: number): string => xtermWindowOp(XTermWindowOp.MOVE_WINDOW, x, y);

/**
 * Raises the terminal window to the front of the stacking order.
 *
 * Sequence: `CSI 5 t`
 * @returns The ANSI escape sequence to raise the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.RAISE_WINDOW
 * @example
 * ```typescript
 * import { raiseWindow } from "@visulima/ansi";
 *
 * process.stdout.write(raiseWindow()); // Sends: "\x1b[5t"
 * ```
 */
export const raiseWindow = (): string => xtermWindowOp(XTermWindowOp.RAISE_WINDOW);

/**
 * Lowers the terminal window to the bottom of the stacking order.
 *
 * Sequence: `CSI 6 t`
 * @returns The ANSI escape sequence to lower the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.LOWER_WINDOW
 * @example
 * ```typescript
 * import { lowerWindow } from "@visulima/ansi";
 *
 * process.stdout.write(lowerWindow()); // Sends: "\x1b[6t"
 * ```
 */
export const lowerWindow = (): string => xtermWindowOp(XTermWindowOp.LOWER_WINDOW);

/**
 * Refreshes the terminal window content.
 * This can be useful if the display becomes corrupted or needs redrawing.
 *
 * Sequence: `CSI 7 t`
 * @returns The ANSI escape sequence to refresh the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.REFRESH_WINDOW
 * @example
 * ```typescript
 * import { refreshWindow } from "@visulima/ansi";
 *
 * process.stdout.write(refreshWindow()); // Sends: "\x1b[7t"
 * ```
 */
export const refreshWindow = (): string => xtermWindowOp(XTermWindowOp.REFRESH_WINDOW);

/**
 * Resizes the terminal window's text area to a specified height and width in pixels.
 *
 * Sequence: `CSI 8 ; height ; width t`
 * @param height The desired height in pixels.
 * @param width The desired width in pixels.
 * @returns The ANSI escape sequence to resize the text area in pixels.
 * @see xtermWindowOp
 * @see XTermWindowOp.RESIZE_TEXT_AREA_PIXELS
 * @example
 * ```typescript
 * import { resizeTextAreaPixels } from "@visulima/ansi";
 *
 * // Resize text area to 600px height, 800px width
 * process.stdout.write(resizeTextAreaPixels(600, 800));
 * // Sends: "\x1b[8;600;800t"
 * ```
 */
export const resizeTextAreaPixels = (height: number, width: number): string => xtermWindowOp(XTermWindowOp.RESIZE_TEXT_AREA_PIXELS, height, width);

/**
 * Restores a maximized terminal window to its previous size and position.
 * XTerm typically uses `CSI 9 ; 0 t` for this operation, where 0 signifies restore.
 * Some interpretations might use `CSI 9 t` if no other parameter implies restore.
 *
 * Sequence: `CSI 9 t` (simplified, relies on `XTermWindowOp.RESTORE_MAXIMIZED_WINDOW` which is 9)
 * More specific might be `CSI 9 ; 0 t`.
 * @returns The ANSI escape sequence to restore a maximized window.
 * @see xtermWindowOp
 * @see XTermWindowOp.RESTORE_MAXIMIZED_WINDOW
 * @example
 * ```typescript
 * import { restoreMaximizedWindow } from "@visulima/ansi";
 *
 * process.stdout.write(restoreMaximizedWindow()); // Sends: "\x1b[9t"
 * ```
 */
export const restoreMaximizedWindow = (): string => xtermWindowOp(XTermWindowOp.RESTORE_MAXIMIZED_WINDOW);

/**
 * Maximizes the terminal window (often a "zoom" or toggle effect).
 * XTerm typically uses `CSI 9 ; 1 t` for this, where 1 signifies maximize.
 * Some terminals might use `CSI 10 t` for a general maximize/toggle.
 * This function uses `XTermWindowOp.MAXIMIZE_WINDOW` which is 10.
 *
 * Sequence: `CSI 10 t` (using `XTermWindowOp.MAXIMIZE_WINDOW`)
 * @returns The ANSI escape sequence to maximize the window.
 * @see xtermWindowOp
 * @see XTermWindowOp.MAXIMIZE_WINDOW
 * @example
 * ```typescript
 * import { maximizeWindow } from "@visulima/ansi";
 *
 * process.stdout.write(maximizeWindow()); // Sends: "\x1b[10t"
 * ```
 */
export const maximizeWindow = (): string => xtermWindowOp(XTermWindowOp.MAXIMIZE_WINDOW);

/**
 * Report window position.
 * Response: `CSI 3 ; x ; y t`
 * `CSI 1 3 t`
 */
export function reportWindowPosition(): string {
    return xtermWindowOp(XTermWindowOp.REPORT_WINDOW_POSITION);
}

/**
 * Report window state.
 * Response: `CSI 1 t` if de-iconified, `CSI 2 t` if iconified.
 * (XTerm doc uses `CSI ? 1 t` and `CSI ? 2 t`, but general form `CSI Ps t` is also listed for 11)
 * `CSI 1 1 t`
 */
export function reportWindowState(): string {
    return xtermWindowOp(XTermWindowOp.REPORT_WINDOW_STATE);
}

/**
 * Set page size (DECSLPP - Set Lines Per Page), often used for resizing the screen.
 * `CSI Pl t` where Pl is the number of lines.
 * XTerm extends this to `CSI > lines ; width ; height t` where width/height are in pixels.
 * `CSI 24 ; lines t`
 * @param lines The number of lines for the page.
 */
export function setPageSizeLines(lines: number): string {
    return xtermWindowOp(XTermWindowOp.RESIZE_SCREEN_AND_TEXT_AREA, lines);
}
