import { ESC } from "./constants";

const alternativeScreen = {
    /**
     * Enter the [alternative screen](https://terminalguide.namepad.de/mode/p47/).
     */
    enter: ESC + "?1049h",
    /**
     * Exit the [alternative screen](https://terminalguide.namepad.de/mode/p47/), assuming `enterAlternativeScreen` was called before.
     */
    exit: ESC + "?1049l",
};

export default alternativeScreen;
