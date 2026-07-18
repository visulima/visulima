import ColorizeImpl from "./colorize.server";
import { GradientBuilder } from "./gradient/gradient-builder";
import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput } from "./types";

const colorize: ColorizeType = new ColorizeImpl();

const WHITESPACE_GLOBAL = /\s/g;
const WHITESPACE_TEST = /\s/;

// Cap the per-gradient color cache so a long-lived gradient applied to strings of
// many distinct lengths (e.g. log/progress lines in a TUI) cannot grow without
// limit; the oldest entry is evicted once the limit is reached.
const MAX_COLOR_CACHE_ENTRIES = 100;

type GradientOptions = {
    hsvSpin?: "long" | "short";
    interpolation?: "hsv" | "rgb";
    loop?: boolean;
    reverse?: boolean;
};

type GradientStops = (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[];

/**
 * Shared setup for {@link gradient} and {@link multilineGradient}: resolve options,
 * build the (optionally looped/reversed) builder and expose a bounded, memoized
 * `getColors(count)`. The only difference between the two public variants is how
 * many colors each line needs and whether the input is split on newlines.
 */
const createGradient = (stops: GradientStops, options: GradientOptions | undefined): { builder: GradientBuilder; getColors: (count: number) => ColorizeType[] } => {
    const { hsvSpin = "short", interpolation = "rgb" } = options ?? {};

    let builder = new GradientBuilder(colorize, stops);

    if (options?.loop) {
        builder = builder.loop();
    } else if (options?.reverse) {
        // eslint-disable-next-line unicorn/no-array-reverse
        builder = builder.reverse();
    }

    const colorCache = new Map<number, ColorizeType[]>();

    const getColors = (count: number): ColorizeType[] => {
        let cached = colorCache.get(count);

        if (!cached) {
            cached = interpolation === "rgb" ? builder.rgb(count) : builder.hsv(count, hsvSpin);

            if (colorCache.size >= MAX_COLOR_CACHE_ENTRIES) {
                colorCache.delete(colorCache.keys().next().value as number);
            }

            colorCache.set(count, cached);
        }

        return cached;
    };

    return { builder, getColors };
};

// Walk the color list with an index cursor instead of copying the array and
// calling `Array#shift()` per character (both O(n)), which made long-string
// gradients quadratic. Whitespace passes through without consuming a color, and
// each color is a single-level rgb() style, so concatenating `open + char + close`
// directly skips the wrapText machinery.
const colorizeLine = (line: string, colors: ColorizeType[]): string => {
    let cursor = 0;
    let result = "";

    for (const character of line) {
        if (WHITESPACE_TEST.test(character)) {
            result += character;
        } else {
            const color = colors[cursor] as ColorizeType;

            cursor += 1;
            result += color.open + character + color.close;
        }
    }

    return result;
};

export const gradient = (stops: GradientStops, options?: GradientOptions): (string_: string) => string => {
    const { builder, getColors } = createGradient(stops, options);

    return (string_: string): string => {
        const stripped = string_.replaceAll(WHITESPACE_GLOBAL, "");
        const colors = getColors(Math.max(stripped.length, builder.stops.length));

        return colorizeLine(string_, colors);
    };
};

export const multilineGradient = (stops: GradientStops, options?: GradientOptions): (string_: string) => string => {
    const { builder, getColors } = createGradient(stops, options);

    return (string_: string): string => {
        const lines = string_.split("\n");
        const colorsCount = Reflect.apply(Math.max, undefined, [...lines.map((l) => l.length), builder.stops.length]);
        const colors = getColors(colorsCount);

        // Reset the cursor per line (each line restarts the gradient) while reusing
        // the cached color array directly instead of copying + shifting.
        return lines.map((line) => colorizeLine(line, colors)).join("\n");
    };
};

export { GradientBuilder } from "./gradient/gradient-builder";
