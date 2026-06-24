import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput, StopOutput } from "../types";
import { convertHexToRgb } from "../util/convert-hex-to-rgb";
import { colorNames } from "./util/color-names";
import { computeSubSteps } from "./util/compute";
import { interpolateHsv, interpolateRgb } from "./util/interpolate";

type StopValue = ColorValueHex | CssColorName | RGB | StopInput | [number, number, number];

/** Resolve a stop's color (tuple, hex/name string, or RGB object) to an `[r, g, b]` tuple. */
const resolveStopColor = (color: StopInput["color"]): [number, number, number] | undefined => {
    if (Array.isArray(color)) {
        return color;
    }

    if (typeof color === "string") {
        return color.includes("#") ? convertHexToRgb(color) : colorNames[color as CssColorName];
    }

    if (color && "r" in color && "g" in color && "b" in color) {
        return [color.r, color.g, color.b];
    }

    return undefined;
};

/** Build a stop from an explicit `{ position, color? }` input, validating ordering and the position range. */
const buildPositionedStop = (stopInput: StopInput, index: number, length: number, lastColorLess: boolean, previousPosition: number): StopOutput => {
    const hasColor = stopInput.color !== undefined;

    if (!hasColor && (lastColorLess || index === 0 || index === length - 1)) {
        throw new Error("Cannot define two consecutive position-only stops");
    }

    const stop: StopOutput = {
        color: hasColor ? resolveStopColor(stopInput.color) : undefined,
        colorLess: !hasColor,
        position: stopInput.position,
    };

    if (stop.position < 0 || stop.position > 1) {
        throw new Error("Color stops positions must be between 0 and 1");
    }

    if (stop.position < previousPosition) {
        throw new Error("Color stops positions are not ordered");
    }

    return stop;
};

/** Build a stop from a bare color value, deriving its position evenly across the gradient. */
const buildAutoStop = (stop: StopValue, index: number, length: number): StopOutput => {
    const position = index / (length - 1);

    if (Array.isArray(stop)) {
        return { color: stop, position };
    }

    if (typeof stop === "string") {
        return { color: stop.includes("#") ? convertHexToRgb(stop) : colorNames[stop as CssColorName], position };
    }

    if ((stop as RGB | undefined)?.r !== undefined && (stop as RGB | undefined)?.g !== undefined && (stop as RGB | undefined)?.b !== undefined) {
        return { color: [(stop as RGB).r, (stop as RGB).g, (stop as RGB).b], position };
    }

    throw new Error("Invalid color stop");
};

// eslint-disable-next-line import/prefer-default-export -- public API uses named export
export class GradientBuilder {
    readonly #colorize: ColorizeType;

    public readonly stops: StopOutput[];

    public constructor(colorize: ColorizeType, stops: StopValue[]) {
        this.#colorize = colorize;
        this.stops = [];

        if (stops.length < 2) {
            throw new Error("Invalid number of stops (< 2)");
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        const havingPositions = (stops[0] as StopInput).position !== undefined;

        let l = stops.length;
        let p = -1;
        let lastColorLess = false;

        // eslint-disable-next-line @typescript-eslint/naming-convention
        for (const [index, stop_] of stops.entries()) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
            const hasPosition = (stop_ as StopInput).position !== undefined;

            if (havingPositions !== hasPosition) {
                throw new Error("Cannot mix positioned and non-positioned color stops");
            }

            let stop: StopOutput;

            if (hasPosition) {
                stop = buildPositionedStop(stop_ as StopInput, index, l, lastColorLess, p);
                lastColorLess = stop.colorLess ?? false;
                p = stop.position;
            } else {
                stop = buildAutoStop(stop_, index, l);
            }

            this.stops.push(stop);
        }

        const firstStop = this.stops[0] as StopOutput;

        if (firstStop.position !== 0) {
            this.stops.unshift({
                color: firstStop.color,
                position: 0,
            });

            l += 1;
        }

        const lastStop = this.stops[l - 1] as StopOutput;

        if (lastStop.position !== 1) {
            this.stops.push({
                color: lastStop.color,
                position: 1,
            });
        }
    }

    public reverse(): GradientBuilder {
        const stops: StopInput[] = [];

        for (const stop of this.stops) {
            const reversedStop = { ...stop, position: 1 - stop.position };

            stops.push(reversedStop);
        }

        return new GradientBuilder(this.#colorize, stops.toReversed());
    }

    public loop(): GradientBuilder {
        const stops1: StopInput[] = [];
        const stops2: StopInput[] = [];

        for (const stop of this.stops) {
            stops1.push({
                color: stop.color,
                position: (stop.position || 0) / 2,
            });
        }

        for (const stop of this.stops.slice(0, -1)) {
            stops2.push({
                color: stop.color,
                position: 1 - (stop.position || 0) / 2,
            });
        }

        return new GradientBuilder(this.#colorize, [...stops1, ...stops2.toReversed()]);
    }

    public rgb(steps: number): ColorizeType[] {
        const subSteps = computeSubSteps(this.stops, steps);
        const gradient: ColorizeType[] = [];

        this.stops.forEach((stop, index) => {
            if (stop.colorLess) {
                const rgbs = interpolateRgb(this.stops[index - 1] as StopOutput, this.stops[index + 1] as StopOutput, 2);

                // eslint-disable-next-line no-param-reassign
                stop.color = [(rgbs[1] as RGB).r, (rgbs[1] as RGB).g, (rgbs[1] as RGB).b];
            }
        });

        for (let index = 0, l = this.stops.length; index < l - 1; index += 1) {
            const rgbs = interpolateRgb(this.stops[index] as StopOutput, this.stops[index + 1] as StopOutput, subSteps[index] as number);

            gradient.splice(gradient.length, 0, ...rgbs.map((rgb) => this.#colorize.rgb(rgb.r, rgb.g, rgb.b)));
        }

        gradient.push(this.#colorize.rgb(...((this.stops.at(-1) as StopOutput).color as [number, number, number])));

        return gradient;
    }

    public hsv(steps: number, mode: boolean | "long" | "short" = false): ColorizeType[] {
        const subSteps = computeSubSteps(this.stops, steps);
        const gradient: ColorizeType[] = [];

        this.stops.forEach((stop, index) => {
            if (stop.colorLess) {
                const rgbs = interpolateHsv(this.stops[index - 1] as StopOutput, this.stops[index + 1] as StopOutput, 2, mode);

                // eslint-disable-next-line no-param-reassign
                stop.color = [(rgbs[1] as RGB).r, (rgbs[1] as RGB).g, (rgbs[1] as RGB).b];
            }
        });

        for (let index = 0, l = this.stops.length; index < l - 1; index += 1) {
            const rgbs = interpolateHsv(this.stops[index] as StopOutput, this.stops[index + 1] as StopOutput, subSteps[index] as number, mode);

            gradient.splice(gradient.length, 0, ...rgbs.map((rgb) => this.#colorize.rgb(rgb.r, rgb.g, rgb.b)));
        }

        gradient.push(this.#colorize.rgb(...((this.stops.at(-1) as StopOutput).color as [number, number, number])));

        return gradient;
    }
}
