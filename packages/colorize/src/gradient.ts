import ColorizeImpl from "./colorize.server";
import { GradientBuilder } from "./gradient/gradient-builder";
import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

const forbiddenChars = /\s/g;

const gradient = (
    stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[],
    options?: {
        loop?: boolean;
        reverse?: boolean;
    },
) => {
    let builder = new GradientBuilder(colorize, stops);

    if (options?.loop) {
        builder = builder.loop();
    } else if (options?.reverse) {
        builder = builder.reverse();
    }

    return (string_: string) => {
        const colorsCount = Math.max(string_.replace(forbiddenChars, "").length, builder.stops.length);
        const colors = builder.rgb(colorsCount);

        let result = "";

        for (const s of string_) {
            result += s.match(forbiddenChars) ? s : colors.shift()(s);
        }

        return result;
    };
};

export default gradient;
