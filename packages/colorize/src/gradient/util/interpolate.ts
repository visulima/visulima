import type { HSVA, RGB, StopOutput } from "../../types";
import { hsvToRgb } from "./hsv-to-rgb";
import { rgbToHsv } from "./rgb-to-hsv";

const RGBA_MAX: RGB = { b: 256, g: 256, r: 256 };
const HSV_MAX: HSVA = { h: 360, s: 1, v: 1 };

const calculateStepSize = <T extends Record<string, number>>(start: T, end: T, steps: number): T => {
    const step: T = {} as T;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            // @TODO: Fix this any type
            // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-explicit-any
            (step as any)[k] = steps === 0 ? 0 : ((end[k] as number) - (start[k] as number)) / steps;
        }
    }

    return step;
};

const interpolate = <T extends Record<string, number>>(step: T, start: T, index: number, max: T): T => {
    const color: T = {} as T;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            // @TODO: Fix this any type
            // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-explicit-any
            (color as any)[k] = (step[k] as number) * index + (start[k] as number);
            // @TODO: Fix this any type
            // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-explicit-any,sonarjs/no-element-overwrite
            (color as any)[k]
                // eslint-disable-next-line security/detect-object-injection
                = (color[k] as number) < 0
                    ? // eslint-disable-next-line security/detect-object-injection
                    (color[k] as number) + (max[k] as number)
                    : // eslint-disable-next-line security/detect-object-injection
                    max[k] === 1
                        ? // eslint-disable-next-line security/detect-object-injection
                        (color[k] as number)
                        : // eslint-disable-next-line security/detect-object-injection
                        (color[k] as number) % (max[k] as number);
        }
    }

    return color;
};

export const interpolateRgb = (stop1: StopOutput, stop2: StopOutput, steps: number): RGB[] => {
    const start: RGB = { b: (stop1.color as number[])[2] as number, g: (stop1.color as number[])[1] as number, r: (stop1.color as number[])[0] as number };
    const end: RGB = { b: (stop2.color as number[])[2] as number, g: (stop2.color as number[])[1] as number, r: (stop2.color as number[])[0] as number };

    const step = calculateStepSize<RGB>(start, end, steps);

    const gradient: RGB[] = [{ ...start }];

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 1; index < steps; index++) {
        const color = interpolate<RGB>(step, start, index, RGBA_MAX);

        gradient.push({
            b: Math.floor(color.b as number),
            g: Math.floor(color.g as number),
            r: Math.floor(color.r as number),
        });
    }

    return gradient;
};

export const interpolateHsv = (
    stop1: StopOutput,
    stop2: StopOutput,
    steps: number,
    mode: boolean | "long" | "short",

): RGB[] => {
    const start = rgbToHsv({ b: (stop1.color as number[])[2] as number, g: (stop1.color as number[])[1] as number, r: (stop1.color as number[])[0] as number });
    const end = rgbToHsv({ b: (stop2.color as number[])[2] as number, g: (stop2.color as number[])[1] as number, r: (stop2.color as number[])[0] as number });

    if (start.s === 0 || end.s === 0) {
        return interpolateRgb(stop1, stop2, steps);
    }

    let trigonometric: boolean;

    if (typeof mode === "boolean") {
        trigonometric = mode;
    } else {
        const trigShortest = (start.h < end.h && end.h - start.h < 180) || (start.h > end.h && start.h - end.h > 180);

        trigonometric = (mode === "long" && trigShortest) || (mode === "short" && !trigShortest);
    }

    const step = calculateStepSize(start, end, steps);
    const gradient: RGB[] = [
        {
            b: (stop1.color as [number, number, number])[2],
            g: (stop1.color as [number, number, number])[1],
            r: (stop1.color as [number, number, number])[0],
        },
    ];

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

        gradient.push(hsvToRgb(color.h, color.s, color.v));
    }

    return gradient;
};
