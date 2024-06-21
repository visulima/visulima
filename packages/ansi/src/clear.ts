import { CSI, ESC } from "./constants";
import erase from "./erase";
import { isWindows } from "./helpers";

const clear = {
    fullReset: ESC + '1;1H' + ESC + 'J',
    /**
     * Erase the screen from the current line down to the bottom of the screen.
     */
    line: erase.line + CSI + "0D",
    /**
     * Easing the terminal screen and moving cursor to top-left. (Viewport)
     */
    screen: ESC + "H" + ESC + "2J",
    scrollbar: ESC + '2J',
    /**
     * Clear the whole terminal, including scrollback buffer. (Not just the visible part of it)
     */
    terminal: isWindows
        ? erase.screen + ESC + "0f"
        : // 1. Erases the screen (Only done in case `2` is not supported)
          // 2. Erases the whole screen including scrollback buffer
          // 3. Moves cursor to the top-left position
          // More info: https://www.real-world-systems.com/docs/ANSIcode.html
          erase.screen + ESC + '3J' + ESC + 'H',
};

export default clear;
