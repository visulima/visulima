/* eslint-disable import/no-named-as-default-member */
import type { AnsiColors, ColorizeType } from "@visulima/colorize";
import colorizeDefault from "@visulima/colorize";

type ColorType = "foreground" | "background";

const rgbRegex = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/;
const ansiRegex = /^ansi256\(\s?(\d+)\s?\)$/;

const isNamedColor = (color: string): color is AnsiColors => color in colorizeDefault;

const colorize = (string_: string, color: string | undefined, type: ColorType): string => {
    if (!color) {
        return string_;
    }

    if (isNamedColor(color)) {
        if (type === "foreground") {
            return (colorizeDefault as unknown as Record<string, ColorizeType>)[color]!(string_);
        }

        const methodName = `bg${color[0]!.toUpperCase() + color.slice(1)}`;

        return (colorizeDefault as unknown as Record<string, ColorizeType>)[methodName]!(string_);
    }

    if (color.startsWith("#")) {
        return type === "foreground" ? colorizeDefault.hex(color as `#${string}`)(string_) : colorizeDefault.bgHex(color as `#${string}`)(string_);
    }

    if (color.startsWith("ansi256")) {
        const matches = ansiRegex.exec(color);

        if (!matches) {
            return string_;
        }

        const value = Number(matches[1]);

        return type === "foreground" ? colorizeDefault.ansi256(value)(string_) : colorizeDefault.bgAnsi256(value)(string_);
    }

    if (color.startsWith("rgb")) {
        const matches = rgbRegex.exec(color);

        if (!matches) {
            return string_;
        }

        const firstValue = Number(matches[1]);
        const secondValue = Number(matches[2]);
        const thirdValue = Number(matches[3]);

        return type === "foreground"
            ? colorizeDefault.rgb(firstValue, secondValue, thirdValue)(string_)
            : colorizeDefault.bgRgb(firstValue, secondValue, thirdValue)(string_);
    }

    return string_;
};

export const getBackgroundColorEscape = (color: string): string | undefined => {
    const colorized = colorize("x", color, "background");

    if (colorized !== "x") {
        return colorized.split("x")[0];
    }

    return undefined;
};

export default colorize;
