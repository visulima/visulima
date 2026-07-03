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

    const colorCache = new Map<number, ColorizeType[]>();

    return (string_: string): string => {
        const stripped = string_.replaceAll(WHITESPACE_GLOBAL, "");
        const colorsCount = Math.max(stripped.length, builder.stops.length);

        let cached = colorCache.get(colorsCount);

        if (!cached) {
            cached = interpolation === "rgb" ? builder.rgb(colorsCount) : builder.hsv(colorsCount, hsvSpin);
            colorCache.set(colorsCount, cached);
        }

        // Walk the cached color list with an index cursor instead of copying the
        // array and calling `Array#shift()` per character (both O(n)), which made
        // long-string gradients quadratic. Each color is a single-level rgb() style,
        // so concatenating `open + char + close` directly skips the wrapText machinery.
        let cursor = 0;
        let result = "";

        for (const s of string_) {
            if (WHITESPACE_TEST.test(s)) {
                result += s;
            } else {
                const color = cached[cursor] as ColorizeType;

                cursor += 1;
                result += color.open + s + color.close;
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

    const colorCache = new Map<number, ColorizeType[]>();

    return (string_: string): string => {
        const lines = string_.split("\n");

        const colorsCount = Reflect.apply(Math.max, undefined, [...lines.map((l) => l.length), builder.stops.length]);

        let colors = colorCache.get(colorsCount);

        if (!colors) {
            colors = interpolation === "rgb" ? builder.rgb(colorsCount) : builder.hsv(colorsCount, hsvSpin);
            colorCache.set(colorsCount, colors);
        }

        const results: string[] = [];

        for (const line of lines) {
            // Reset the cursor per line (each line restarts the gradient) but reuse
            // the cached color array directly instead of copying + shifting.
            let cursor = 0;
            let lineResult = "";

            for (const l of line) {
                if (WHITESPACE_TEST.test(l)) {
                    lineResult += l;
                } else {
                    const color = colors[cursor] as ColorizeType;

                    cursor += 1;
                    lineResult += color.open + l + color.close;
                }
            }

            results.push(lineResult);
        }

        return results.join("\n");
    };
};

export { GradientBuilder } from "./gradient/gradient-builder";
