import type { AnsiColors, AnsiStyles } from "ansis";

import { baseColors, baseStyles, createAnsi256, createBgAnsi256, createBgRgb, createRgb } from "./ansi-codes";
import type { ColorData, ColorizeType } from "./types";
import { clamp, hexToRgb, stringReplaceAll } from "./utils";

// eslint-disable-next-line no-control-regex,regexp/no-control-character,security/detect-unsafe-regex
const ANSI_REGEX = /[\u001B\u009B][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[\dA-ORZcf-nqry=><]/g;
const NEWLINE_REGEX = /(\r*\n)/g;

interface StyleMethod {
    bg: (code: number) => ColorData;
    bgHex: (hex: string) => ColorData;
    bgRgb: (r: number, g: number, b: number) => ColorData;
    fg: (code: number) => ColorData;
    hex: (hex: string) => ColorData;
    rgb: (r: number, g: number, b: number) => ColorData;
}

const styleMethods: StyleMethod = {
    bg: (code) => createBgAnsi256(clamp(code, 0, 255)),
    bgHex: (hex) => createBgRgb(...hexToRgb(hex)),
    bgRgb: (r, g, b) => createBgRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
    fg: (code) => createAnsi256(clamp(code, 0, 255)),
    hex: (hex) => createRgb(...hexToRgb(hex)),
    rgb: (r, g, b) => createRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
};

const styles: Record<string, any> = {};

let stylePrototype: object | null = null;

const wrapText = (strings: string | { raw: ArrayLike<string> | ReadonlyArray<string> }, values: string[], properties) => {
    if (!strings) {
        return "";
    }

    let string = strings.raw == null ? strings as string : String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

    if (string.includes("\u001B")) {
        // eslint-disable-next-line no-loops/no-loops
        while (properties) {
            string = stringReplaceAll(string, properties.close, properties.open);

            properties = properties.props;
        }
    }

    if (string.includes("\n")) {
        string = string.replaceAll(NEWLINE_REGEX, `${properties.closeStack}$1${properties.openStack}`);
    }

    return properties.openStack + string + properties.closeStack;
};

type ColorizeProperties = ColorData & { closeStack?: string; openStack?: string; props: ColorizeProperties };

const createStyle = (
    { props }: { props?: ColorizeProperties },
    { close, open }: ColorData,
): {
    (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]): string;
    close: string;
    open: string;
    props: { close: string; closeStack: string; open: string; openStack: string; props: ColorizeProperties | undefined };
} => {
    let openStack = open;
    let closeStack = close;

    if (props) {
        openStack = props.openStack + open;
        closeStack = close + props.closeStack;
    }

    const style = (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values) => wrapText(strings, values, style.props);

    Object.setPrototypeOf(style, stylePrototype);

    style.props = { close, closeStack, open, openStack, props };
    style.open = openStack;
    style.close = closeStack;

    return style;
};

class ColorizeImpl {
    public constructor() {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const name in styleMethods) {
            styles[name as keyof typeof styleMethods] = {
                get() {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    return (...arguments_) => createStyle(this, styleMethods[name as keyof typeof styleMethods](...arguments_));
                },
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        styles["ansi256"] = styles["fg"];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        styles["bgAnsi256"] = styles["bg"];

        const base = { ...baseColors, ...baseStyles };

        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const name in base) {
            // eslint-disable-next-line security/detect-object-injection
            styles[name] = {
                get() {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    const style = createStyle(this, base[name as keyof typeof base]);

                    Object.defineProperty(this, name, { value: style });

                    return style;
                },
            };
        }

        // This needs to be the last thing we do, so that the prototype is fully populated.
        stylePrototype = Object.defineProperties({}, styles);
        Object.setPrototypeOf(this, stylePrototype);
    }

    // eslint-disable-next-line class-methods-use-this
    public strip(value: string): string {
        return value.replaceAll(ANSI_REGEX, "");
    }

    public extend(colors: Record<AnsiColors, ColorData | string> | Record<AnsiStyles, ColorData | string> | Record<string, ColorData | string>): void {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const name in colors) {
            const value = colors[name as keyof typeof colors] as ColorData | string;

            let styleCodes = value;

            if (Object.prototype.toString.call(value).slice(8, -1) === "String") {
                styleCodes = createRgb(...hexToRgb(value as string));
            }

            // eslint-disable-next-line security/detect-object-injection
            styles[name] = {
                get() {
                    const style = createStyle(this, styleCodes);

                    Object.defineProperty(this, name, { value: style });

                    return style;
                },
            };
        }

        stylePrototype = Object.defineProperties(() => {}, styles);

        Object.setPrototypeOf(this, stylePrototype);
    }
}

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export const Colorize = ColorizeImpl as unknown as ColorizeType;

// eslint-disable-next-line import/no-default-export
export default colorize as ColorizeType;

export const {
    ansi256,
    bg,
    bgAnsi256,
    bgBlack,
    bgBlackBright,
    bgBlue,
    bgBlueBright,
    bgCyan,
    bgCyanBright,
    bgGray,
    bgGreen,
    bgGreenBright,
    bgHex,
    bgMagenta,
    bgMagentaBright,
    bgRed,
    bgRedBright,
    bgRgb,
    bgWhite,
    bgWhiteBright,
    bgYellow,
    bgYellowBright,
    black,
    blackBright,
    blue,
    blueBright,
    bold,
    cyan,
    cyanBright,
    dim,
    fg,
    gray,
    green,
    greenBright,
    grey,
    hex,
    hidden,
    inverse,
    italic,
    magenta,
    magentaBright,
    red,
    redBright,
    reset,
    rgb,
    strike,
    strikethrough,
    underline,
    visible,
    white,
    whiteBright,
    yellow,
    yellowBright,
} = colorize;
