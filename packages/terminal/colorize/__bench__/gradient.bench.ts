import { bench, describe } from "vitest";

import ColorizeImpl from "../src/colorize.server";
import { gradient, GradientBuilder } from "../src/gradient";
import type { ColorizeType } from "../src/types";

const colorizeInstance: ColorizeType = new ColorizeImpl();

const stops = ["#ff0000", "#00ff00", "#0000ff"];

const WHITESPACE_GLOBAL = /\s/g;
const WHITESPACE_TEST = /\s/;

/**
 * Previous (uncached) implementation: recomputes the full color interpolation
 * on every render call.
 */
const uncachedGradient = (input: typeof stops): ((string_: string) => string) => {
    const builder = new GradientBuilder(colorizeInstance, input);

    return (string_: string): string => {
        const stripped = string_.replaceAll(WHITESPACE_GLOBAL, "");
        const colorsCount = Math.max(stripped.length, builder.stops.length);
        const colors = builder.rgb(colorsCount);

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

const SAMPLE = "The quick brown fox jumps over the lazy dog repeatedly for the benchmark run";

describe("gradient render (repeated calls, same length)", () => {
    const cached = gradient(stops);
    const uncached = uncachedGradient(stops);

    bench("cached (Map memoization)", () => {
        for (let index = 0; index < 100; index += 1) {
            cached(SAMPLE);
        }
    });

    bench("uncached (recompute every call)", () => {
        for (let index = 0; index < 100; index += 1) {
            uncached(SAMPLE);
        }
    });
});
