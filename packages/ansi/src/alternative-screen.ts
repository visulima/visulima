import { ESC } from "./constants";

/**
 * Enter the [alternative screen](https://terminalguide.namepad.de/mode/p47/).
 *
 * @returns The escape sequence to enter the alternative screen.
 */
export const alternativeScreenEnter = ESC + "?1049h";

/**
 * Exit the [alternative screen](https://terminalguide.namepad.de/mode/p47/), assuming `enterAlternativeScreen` was called before.
 *
 * @returns The escape sequence to exit the alternative screen.
 */
export const alternativeScreenExit = ESC + "?1049l";
