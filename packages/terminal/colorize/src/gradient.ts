import ColorizeImpl from "./colorize.server";
import { GradientBuilder } from "./gradient/gradient-builder";
import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput } from "./types";

const colorize: ColorizeType = new ColorizeImpl();

const WHITESPACE_GLOBAL = /\s/g;
const WHITESPACE_TEST = /\s/;

export const gradient = (
    stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[],
    options?: {
        hsvSpin?: "long" | "short";
        interpolation?: "hsv" | "rgb";
        loop?: boolean;
        reverse?: boolean;
    },
): (string_: string) => string => {
    const { hsvSpin = "short", interpolation = "rgb" } = options ?? {};

    let builder = new GradientBuilder(colorize, stops);

    if (options?.loop) {
        builder = builder.loop();
    } else if (options?.reverse) {
        // eslint-disable-next-line unicorn/no-array-reverse
        builder = builder.reverse();
    }

    return (string_: string): string => {
        const stripped = string_.replaceAll(WHITESPACE_GLOBAL, "");
        const colorsCount = Math.max(stripped.length, builder.stops.length);
        const colors = interpolation === "rgb" ? builder.rgb(colorsCount) : builder.hsv(colorsCount, hsvSpin);

        let result = "";

        for (const s of string_) {
            if (WHITESPACE_TEST.test(s)) {
                result += s;
            } else {
                const color = colors.shift();

                result += (color as ColorizeType)(s);
            }
        }

        return result;
    };
};

export const multilineGradient = (
    stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[],
    options?: {
        hsvSpin?: "long" | "short";
        interpolation?: "hsv" | "rgb";
        loop?: boolean;
        reverse?: boolean;
    },
): (string_: string) => string => {
    const { hsvSpin = "short", interpolation = "rgb" } = options ?? {};

    let builder = new GradientBuilder(colorize, stops);

    if (options?.loop) {
        builder = builder.loop();
    } else if (options?.reverse) {
        // eslint-disable-next-line unicorn/no-array-reverse
        builder = builder.reverse();
    }

    return (string_: string): string => {
        const lines = string_.split("\n");

        const colorsCount = Reflect.apply(Math.max, undefined, [...lines.map((l) => l.length), builder.stops.length]);
        const colors = interpolation === "rgb" ? builder.rgb(colorsCount) : builder.hsv(colorsCount, hsvSpin);

        const results: string[] = [];

        for (const line of lines) {
            const lineColors = [...colors];

            let lineResult = "";

            for (const l of line) {
                lineResult += WHITESPACE_TEST.test(l) ? l : (lineColors.shift() as ColorizeType)(l);
            }

            results.push(lineResult);
        }

        return results.join("\n");
    };
};

export { GradientBuilder } from "./gradient/gradient-builder";
