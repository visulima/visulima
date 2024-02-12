export interface ColorizeType {
    /**
     * Return styled string.
     *
     * @param {string | TemplateStringsArray} string
     */
    (string: number): string;
    (string: string): string;
    (string: TemplateStringsArray, ...parameters: string[]): string;

    /**
     * Set [256-color ANSI code](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) for foreground color.
     *
     * Code ranges:
     * ```
     *   0 -   7: standard colors
     *   8 -  15: high intensity colors
     *  16 - 231: 6 × 6 × 6 cube (216 colors)
     * 232 - 255: grayscale from black to white in 24 steps
     * ```
     *
     * @param {number} code in range [0, 255].
     */
    ansi256: (code: number) => this;

    /**
     * Alias for bgAnsi256.
     *
     * @param {number} code in range [0, 255].
     */
    bg: (code: number) => this;

    /**
     * Set [256-color ANSI code](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) for background color.
     *
     * Code ranges:
     * ```
     *   0 -   7: standard colors
     *   8 -  15: high intensity colors
     *  16 - 231: 6 × 6 × 6 cube (216 colors)
     * 232 - 255: grayscale from black to white in 24 steps
     * ```
     *
     * @param {number} code in range [0, 255].
     */
    bgAnsi256: (code: number) => this;

    readonly bgBlack: this;

    readonly bgBlackBright: this;

    readonly bgBlue: this;

    readonly bgBlueBright: this;

    readonly bgCyan: this;

    readonly bgCyanBright: this;

    readonly bgGray: this;

    readonly bgGreen: this;

    readonly bgGreenBright: this;

    readonly bgGrey: this;

    /**
     * Set HEX value for background color.
     *
     * @param {string} hex
     */
    bgHex: (color: string) => this;

    readonly bgMagenta: this;

    readonly bgMagentaBright: this;

    readonly bgRed: this;

    readonly bgRedBright: this;

    /**
     * Set RGB values for background color.
     *
     * @param {number} red The red value, in range [0, 255].
     * @param {number} green The green value, in range [0, 255].
     * @param {number} blue The blue value, in range [0, 255].
     */
    bgRgb: (red: number, green: number, blue: number) => this;

    readonly bgWhite: this;

    readonly bgWhiteBright: this;

    readonly bgYellow: this;

    readonly bgYellowBright: this;

    readonly black: this;

    readonly blackBright: this;

    readonly blue: this;

    readonly blueBright: this;

    /** <b>Bold</b> style (high intensity). */
    readonly bold: this;

    /** The ANSI escape sequences for ending the current style. */
    readonly close: string;
    readonly cyan: this;
    readonly cyanBright: this;

    /** Faint style (low intensity or dim). */
    readonly dim: this;

    /**
     * Alias for ansi256.
     *
     * @param {number} code in range [0, 255].
     */
    fg: (code: number) => this;
    readonly gray: this;
    readonly green: this;
    readonly greenBright: this;
    readonly grey: this;

    /**
     * Set HEX value for foreground color.
     *
     * @param {string} hex
     */
    hex: (color: string) => this;

    /** Print the invisible text. */
    readonly hidden: this;

    /** Invert background and foreground colors. */
    readonly inverse: this;

    /** <i>Italic</i> style. (Not widely supported) */
    readonly italic: this;

    readonly magenta: this;
    readonly magentaBright: this;

    /** The ANSI escape sequences for starting the current style. */
    readonly open: string;

    /** O̅v̅e̅r̅l̅i̅n̅e̅ style. (Not widely supported) */
    readonly overline: this;

    readonly red: this;
    readonly redBright: this;

    /** Reset the current style. */
    readonly reset: this;

    /**
     * Set RGB values for foreground color.
     *
     * @param {number} red The red value, in range [0, 255].
     * @param {number} green The green value, in range [0, 255].
     * @param {number} blue The blue value, in range [0, 255].
     */
    rgb: (red: number, green: number, blue: number) => this;

    /** S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ style. (Not widely supported) The alias for `strikethrough`. */
    readonly strike: this;

    /** S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ style. (Not widely supported) */
    readonly strikethrough: this;

    /**
     * Remove ANSI styling codes.
     *
     * @param {string} str
     * @return {string}
     */
    strip: (string: string) => string;

    /** U̲n̲d̲e̲r̲l̲i̲n̲e̲ style. (Not widely supported) */
    readonly underline: this;

    /** Print visible text without ANSI styling. */
    readonly visible: this;
    readonly white: this;
    readonly whiteBright: this;
    readonly yellow: this;
    readonly yellowBright: this;
}

export type ColorData = { close: string; open: string };

/**
 * Base ANSI Styles
 */
export type AnsiStyles = "bold" | "dim" | "hidden" | "inverse" | "italic" | "overline" | "reset" | "strike" | "strikethrough" | "underline" | "visible";

/**
 * Base ANSI Colors
 */
export type AnsiColors =
    | "bgBlack"
    | "bgBlackBright"
    | "bgBlue"
    | "bgBlueBright"
    | "bgCyan"
    | "bgCyanBright"
    | "bgGray"
    | "bgGreen"
    | "bgGreenBright"
    | "bgGrey"
    | "bgMagenta"
    | "bgMagentaBright"
    | "bgRed"
    | "bgRedBright"
    | "bgWhite"
    | "bgWhiteBright"
    | "bgYellow"
    | "bgYellowBright"
    | "black"
    | "blackBright"
    | "blue"
    | "blueBright"
    | "cyan"
    | "cyanBright"
    | "gray"
    | "green"
    | "greenBright"
    | "grey"
    | "magenta"
    | "magentaBright"
    | "red"
    | "redBright"
    | "white"
    | "whiteBright"
    | "yellow"
    | "yellowBright";
