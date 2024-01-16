// eslint-disable-next-line import/no-extraneous-dependencies
import ansiRegex from "ansi-regex";
import type { LiteralUnion } from "type-fest";

import { baseColors, baseStyles, createAnsi256, createBgAnsi256, createBgRgb, createRgb } from "./ansi-codes";
import type { ColorData, ColorizeType } from "./types";
import { clamp, hexToRgb, NEWLINE_REGEX, stringReplaceAll } from "./utils";

const styleMethods: {
    bg: (code: number) => ColorData;
    bgHex: (hex: string) => ColorData;
    bgRgb: (r: number, g: number, b: number) => ColorData;
    fg: (code: number) => ColorData;
    hex: (hex: string) => ColorData;
    rgb: (r: number, g: number, b: number) => ColorData;
} = {
    bg: (code) => createBgAnsi256(clamp(code, 0, 255)),
    bgHex: (hex) => createBgRgb(...hexToRgb(hex)),
    bgRgb: (r, g, b) => createBgRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
    fg: (code) => createAnsi256(clamp(code, 0, 255)),
    hex: (hex) => createRgb(...hexToRgb(hex)),
    rgb: (r, g, b) => createRgb(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)),
};

const styles: Record<string, object> = {};

let stylePrototype: object | null = null;

const wrapText = (
    strings: ArrayLike<string> | ReadonlyArray<string> | string | { raw: ArrayLike<string> | ReadonlyArray<string> },
    values: string[],
    properties: ColorizeProperties,
) => {
    if (!strings) {
        return "";
    }

    let string =
        (strings as { raw?: ArrayLike<string> | ReadonlyArray<string> | null }).raw == null
            ? (strings as string)
            : String.raw(strings as { raw: ArrayLike<string> | ReadonlyArray<string> }, ...values);

    if (string.includes("\u001B")) {
        // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/no-unnecessary-condition
        for (let currentProperties = properties; currentProperties; currentProperties = currentProperties.props) {
            string = stringReplaceAll(string, currentProperties.close, currentProperties.open);
        }
    }

    if (string.includes("\n")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        string = string.replaceAll(NEWLINE_REGEX, `${properties.closeStack}$1${properties.openStack}`);
    }

    return properties.openStack + string + properties.closeStack;
};

type ColorizeProperties = { close: string; closeStack: string; open: string; openStack: string; props: ColorizeProperties };

const createStyle = (
    { props }: { props?: ColorizeProperties },
    { close, open }: ColorData,
): {
    (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]): string;
    close: string;
    open: string;
    props: { close: string; closeStack: string; open: string; openStack: string; props?: ColorizeProperties };
} => {
    const openStack: string = (props?.openStack ?? "") + open;
    const closeStack: string = close + (props?.closeStack ?? "");

    const style = (strings: ArrayLike<string> | ReadonlyArray<string> | string, ...values: string[]) => wrapText(strings, values, style.props);

    Object.setPrototypeOf(style, stylePrototype);

    style.props = { close, closeStack, open, openStack, props } as ColorizeProperties;
    style.open = openStack;
    style.close = closeStack;

    return style;
};

// eslint-disable-next-line func-names
const ColorizeImpl = function () {
    const self = (string_: string) => string_;

    self.strip = (value: string): string => value.replaceAll(ansiRegex(), "");

    self.extend = (colors: Record<string, LiteralUnion<ColorData, string>>): void => {
        // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
        for (const name in colors) {
            const value = colors[name as keyof typeof colors] as LiteralUnion<ColorData, string>;

            let styleCodes = value as ColorData;

            if (Object.prototype.toString.call(value).slice(8, -1) === "String") {
                styleCodes = createRgb(...hexToRgb(value as string));
            }

            // eslint-disable-next-line security/detect-object-injection
            styles[name] = {
                get() {
                    const style = createStyle(this, styleCodes as ColorData);

                    Object.defineProperty(this, name, { value: style });

                    return style;
                },
            };
        }

        stylePrototype = Object.defineProperties(() => {}, styles);

        Object.setPrototypeOf(self, stylePrototype);
    };

    const base = { ...baseColors, ...baseStyles };

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const name in base) {
        // eslint-disable-next-line security/detect-object-injection
        styles[name] = {
            get() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const style = createStyle(this, base[name as keyof typeof base]);

                Object.defineProperty(this, name, { value: style });

                return style;
            },
        };
    }

    // This needs to be the last thing we do, so that the prototype is fully populated.
    stylePrototype = Object.defineProperties({}, styles);
    Object.setPrototypeOf(self, stylePrototype);

    return self;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as new () => ColorizeType;

// eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
for (const name in styleMethods) {
    styles[name as keyof typeof styleMethods] = {
        get() {
            return (...arguments_: (number | string)[]) =>
                // @ts-expect-error: TODO: fix typing of `arguments_`

                createStyle(this, styleMethods[name as keyof typeof styleMethods](...arguments_));
        },
    };
}

styles["ansi256"] = styles["fg"] as object;
styles["bgAnsi256"] = styles["bg"] as object;

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export const Colorize = ColorizeImpl;

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

export type { AnsiColors, AnsiStyles, ColorizeType } from "./types"
