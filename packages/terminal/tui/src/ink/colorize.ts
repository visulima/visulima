// eslint-disable-next-line import/no-extraneous-dependencies
import colorizeDefault, { type AnsiColors, type ColorizeType } from "@visulima/colorize";

type ColorType = "foreground" | "background";

const rgbRegex = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/;
const ansiRegex = /^ansi256\(\s?(\d+)\s?\)$/;

const isNamedColor = (color: string): color is AnsiColors => {
    return color in colorizeDefault;
};

const colorize = (str: string, color: string | undefined, type: ColorType): string => {
    if (!color) {
        return str;
    }

    if (isNamedColor(color)) {
        if (type === "foreground") {
            return (colorizeDefault as unknown as Record<string, ColorizeType>)[color]!(str);
        }

        const methodName = `bg${color[0]!.toUpperCase() + color.slice(1)}`;

        return (colorizeDefault as unknown as Record<string, ColorizeType>)[methodName]!(str);
    }

    if (color.startsWith("#")) {
        return type === "foreground" ? colorizeDefault.hex(color as `#${string}`)(str) : colorizeDefault.bgHex(color as `#${string}`)(str);
    }

    if (color.startsWith("ansi256")) {
        const matches = ansiRegex.exec(color);

        if (!matches) {
            return str;
        }

        const value = Number(matches[1]);

        return type === "foreground" ? colorizeDefault.ansi256(value)(str) : colorizeDefault.bgAnsi256(value)(str);
    }

    if (color.startsWith("rgb")) {
        const matches = rgbRegex.exec(color);

        if (!matches) {
            return str;
        }

        const firstValue = Number(matches[1]);
        const secondValue = Number(matches[2]);
        const thirdValue = Number(matches[3]);

        return type === "foreground" ? colorizeDefault.rgb(firstValue, secondValue, thirdValue)(str) : colorizeDefault.bgRgb(firstValue, secondValue, thirdValue)(str);
    }

    return str;
};

export default colorize;
