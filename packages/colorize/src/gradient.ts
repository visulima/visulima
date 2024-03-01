import ColorizeImpl from "./colorize.server";
import { GradientBuilder } from "./gradient/gradient-builder";
import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

const forbiddenChars = /\s/g;

export const gradient = (
    stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[],
    options?: {
        hsvSpin?: "long" | "short";
        interpolation?: "hsv" | "rgb";
        loop?: boolean;
        reverse?: boolean;
    },
): ((string_: string) => string) => {
    const { hsvSpin = "short", interpolation = "rgb" } = options ?? {};

    let builder = new GradientBuilder(colorize, stops);

    if (options?.loop) {
        builder = builder.loop();
    } else if (options?.reverse) {
        builder = builder.reverse();
    }

    return (string_: string): string => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const colorsCount = Math.max(string_.replaceAll(forbiddenChars, "").length, builder.stops.length);
        const colors = interpolation === "rgb" ? builder.rgb(colorsCount) : builder.hsv(colorsCount, hsvSpin);

        let result = "";

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const s of string_) {
            if (forbiddenChars.test(s)) {
                result += s;
            } else {
                const color = colors.shift();

                result += (color as ColorizeType)(s);
            }
        }

        return result;
    };
};
