import { CSI, ESC } from "./constants";
import { eraseLine, eraseScreen } from "./erase";
import { isWindows } from "./helpers";

export const fullReset = ESC + "1;1H" + ESC + "J";

/**
 * Erase the screen from the current line down to the bottom of the screen.
 */
export const clearLine = eraseLine + CSI + "0D";

/**
 * Easing the terminal screen and moving cursor to top-left. (Viewport)
 */
export const clearScreen = ESC + "H" + ESC + "2J";

export const clearScrollbar = ESC + "2J";

/**
 * Clear the whole terminal, including scrollback buffer. (Not just the visible part of it)
 */
export const clearTerminal = isWindows
    ? eraseScreen + ESC + "0f"
    : // 1. Erases the screen (Only done in case `2` is not supported)
      // 2. Erases the whole screen including scrollback buffer
      // 3. Moves cursor to the top-left position
      // More info: https://www.real-world-systems.com/docs/ANSIcode.html
      eraseScreen + ESC + "3J" + ESC + "H" + ESC + "c";
