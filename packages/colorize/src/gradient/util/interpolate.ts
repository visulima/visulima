import type { ColorizeType, HSVA, RGB, StopOutput } from "../../types";
import { hsvToRgb } from "./hsv-to-rgb";
import { rgbToHsv } from "./rgb-to-hsv";

const RGBA_MAX: RGB = { b: 256, g: 256, r: 256 };
const HSV_MAX: HSVA = { h: 360, s: 1, v: 1 };

const stepize = <T>(start: T, end: T, steps: number): T => {
    const step: T = {};

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            step[k] = steps === 0 ? 0 : (end[k] - start[k]) / steps;
        }
    }

    return step;
};

const interpolate = <T>(step: T, start: T, index: number, max: T): T => {
    const color: T = {} as T;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            color[k] = step[k] * index + start[k];
            color[k] = color[k] < 0 ? color[k] + max[k] : max[k] === 1 ? color[k] : color[k] % max[k];
        }
    }

    return color;
};

export const interpolateRgb = (colorize: ColorizeType, stop1: StopOutput, stop2: StopOutput, steps: number): ColorizeType[] => {
    const start: RGB = { b: (stop1.color as number[])[2] as number, g: (stop1.color as number[])[1] as number, r: (stop1.color as number[])[0] as number };

    const end: RGB = { b: (stop2.color as number[])[2] as number, g: (stop2.color as number[])[1] as number, r: (stop2.color as number[])[0] as number };

    const step = stepize<RGB>(start, end, steps);

    const gradient: ColorizeType[] = [colorize.rgb(...(stop1.color as [number, number, number]))];

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 1; index < steps; index++) {
        const color = interpolate<RGB>(step, start, index, RGBA_MAX);

        gradient.push(colorize.rgb(Math.floor(color.r), Math.floor(color.g), Math.floor(color.b)));
    }

    return gradient;
};

export const interpolateHsv = (
    colorize: ColorizeType,
    stop1: StopOutput,
    stop2: StopOutput,
    steps: number,
    mode: boolean | "long" | "short",
    // eslint-disable-next-line sonarjs/cognitive-complexity
): ColorizeType[] => {
    const start = rgbToHsv({ b: (stop1.color as number[])[2] as number, g: (stop1.color as number[])[1] as number, r: (stop1.color as number[])[0] as number });
    const end = rgbToHsv({ b: (stop2.color as number[])[2] as number, g: (stop2.color as number[])[1] as number, r: (stop2.color as number[])[0] as number });

    if (start.s === 0 || end.s === 0) {
        return interpolateRgb(colorize, stop1, stop2, steps);
    }

    let trigonometric: boolean;

    if (typeof mode === "boolean") {
        trigonometric = mode;
    } else {
        const trigShortest = (start.h < end.h && end.h - start.h < 180) || (start.h > end.h && start.h - end.h > 180);

        trigonometric = (mode === "long" && trigShortest) || (mode === "short" && !trigShortest);
    }

    const step = stepize(start, end, steps);
    const gradient: ColorizeType[] = [colorize.rgb(...(stop1.color as [number, number, number]))];

    let diff: number;

    if ((start.h <= end.h && !trigonometric) || (start.h >= end.h && trigonometric)) {
        diff = end.h - start.h;
    } else if (trigonometric) {
        diff = 360 - end.h + start.h;
    } else {
        diff = 360 - start.h + end.h;
    }

    step.h = ((-1) ** (trigonometric ? 1 : 0) * Math.abs(diff)) / steps;

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 1; index < steps; index++) {
        const color = interpolate<HSVA>(step, start, index, HSV_MAX);

        const rgb = hsvToRgb(color.h, color.s, color.v);

        gradient.push(colorize.rgb(rgb.r, rgb.g, rgb.b));
    }

    return gradient;
};
