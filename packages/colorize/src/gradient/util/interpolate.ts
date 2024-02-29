import type { ColorizeType, RGB, StopOutput } from "../../types";
import { stepize } from "./stepize";

const RGBA_MAX: RGB = { b: 256, g: 256, r: 256 };

const interpolate = <T>(step: T, start: T, index: number, max: T): T => {
    const color: T = {} as T;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            color[k] = step[k]! * index + start[k]!;
            color[k] = color[k]! < 0 ? color[k]! + max[k]! : max[k] === 1 ? color[k]! : color[k]! % max[k]!;
        }
    }

    return color;
};

export const interpolateRgb = (colorize: ColorizeType, stop1: StopOutput, stop2: StopOutput, steps: number): ColorizeType[] => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const start: RGB = { b: (stop1.color as number[])[2] as number, g: (stop1.color as number[])[1] as number, r: (stop1.color as number[])[0] as number };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const end: RGB = { b: (stop2.color as number[])[2] as number, g: (stop2.color as number[])[1] as number, r: (stop2.color as number[])[0] as number };

    const step = stepize<RGB>(start, end, steps);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const gradient: ColorizeType[] = [colorize.rgb(...(stop1.color as [number, number, number]))];

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 1; index < steps; index++) {
        const color = interpolate<RGB>(step, start, index, RGBA_MAX);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        gradient.push(colorize.rgb(color.r, color.g, color.b));
    }

    return gradient;
};
