import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput, StopOutput } from "../types";
import { convertHexToRgb } from "../util/convert-hex-to-rgb";
import { colorNames } from "./util/color-names";
import { computeSubSteps } from "./util/compute";
import { interpolateHsv, interpolateRgb } from "./util/interpolate";

export class GradientBuilder {
    readonly #colorize: ColorizeType;

    public readonly stops: StopOutput[];

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public constructor(colorize: ColorizeType, stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[]) {
        this.#colorize = colorize;
        this.stops = [];

        if (stops.length < 2) {
            throw new Error("Invalid number of stops (< 2)");
        }

        const havingPositions = (stops[0] as StopInput).position !== undefined;

        let l = stops.length;
        let p = -1;
        let lastColorLess = false;

        // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/naming-convention
        for (const [index, stop_] of stops.entries()) {
            let stop = {} as StopOutput;

            const hasPosition = (stop_ as StopInput).position !== undefined;

            if (havingPositions !== hasPosition) {
                throw new Error("Cannot mix positioned and non-positioned color stops");
            }

            if (hasPosition) {
                const stopInput = stop_ as StopInput;

                const hasColor = stopInput.color !== undefined;

                if (!hasColor && (lastColorLess || index === 0 || index === l - 1)) {
                    throw new Error("Cannot define two consecutive position-only stops");
                }

                lastColorLess = !hasColor;

                let color: [number, number, number] | undefined;

                if (hasColor) {
                    if (Array.isArray(stopInput.color)) {
                        color = stopInput.color as [number, number, number];
                    } else if (typeof stopInput.color === "string") {
                        color = stopInput.color.includes("#") ? convertHexToRgb(stopInput.color as ColorValueHex) : colorNames[stopInput.color as CssColorName];
                    } else if ((stopInput.color as RGB).r !== undefined && (stopInput.color as RGB).g !== undefined && (stopInput.color as RGB).b) {
                        color = [(stopInput.color as RGB).r, (stopInput.color as RGB).g, (stopInput.color as RGB).b];
                    }
                }

                stop = {
                    color,
                    colorLess: !hasColor,
                    position: stopInput.position,
                };

                if (stop.position < 0 || stop.position > 1) {
                    throw new Error("Color stops positions must be between 0 and 1");
                } else if (stop.position < p) {
                    throw new Error("Color stops positions are not ordered");
                }

                p = stop.position;
            } else if (Array.isArray(stop_)) {
                stop = {
                    color: stop_ as [number, number, number],
                    position: index / (l - 1),
                };
            } else if (typeof stop_ === "string") {
                stop = {
                    color: stop_.includes("#") ? convertHexToRgb(stop_ as ColorValueHex) : colorNames[stop_ as CssColorName],
                    position: index / (l - 1),
                };
            } else if ((stop_ as RGB).r !== undefined && (stop_ as RGB).g !== undefined && (stop_ as RGB).b !== undefined) {
                stop = {
                    color: [(stop_ as RGB).r, (stop_ as RGB).g, (stop_ as RGB).b],
                    position: index / (l - 1),
                };
            } else {
                throw new Error("Invalid color stop");
            }

            this.stops.push(stop);
        }

        if ((this.stops[0] as StopOutput).position !== 0) {
            this.stops.unshift({
                color: (this.stops[0] as StopOutput).color,
                position: 0,
            });

            // eslint-disable-next-line no-plusplus
            l++;
        }

        if ((this.stops[l - 1] as StopOutput).position !== 1) {
            this.stops.push({
                color: (this.stops[l - 1] as StopOutput).color,
                position: 1,
            });
        }
    }

    public reverse(): GradientBuilder {
        const stops: StopInput[] = [];

        // eslint-disable-next-line no-loops/no-loops
        for (const stop of this.stops) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const stop_ = { ...stop };

            stop_.position = 1 - stop.position;

            stops.push(stop_ as StopInput);
        }

        // eslint-disable-next-line etc/no-assign-mutated-array
        return new GradientBuilder(this.#colorize, stops.reverse());
    }

    public loop(): GradientBuilder {
        const stops1: StopInput[] = [];
        const stops2: StopInput[] = [];

        // eslint-disable-next-line no-loops/no-loops
        for (const stop of this.stops) {
            stops1.push({
                color: stop.color,
                position: (stop.position || 0) / 2,
            } as StopInput);
        }

        // eslint-disable-next-line no-loops/no-loops
        for (const stop of this.stops.slice(0, -1)) {
            stops2.push({
                color: stop.color,
                position: 1 - (stop.position || 0) / 2,
            } as StopInput);
        }

        // eslint-disable-next-line etc/no-assign-mutated-array
        return new GradientBuilder(this.#colorize, [...stops1, ...stops2.reverse()]);
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

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0, l = this.stops.length; index < l - 1; index++) {
            // eslint-disable-next-line security/detect-object-injection
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

        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (let index = 0, l = this.stops.length; index < l - 1; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const rgbs = interpolateHsv(this.stops[index] as StopOutput, this.stops[index + 1] as StopOutput, subSteps[index] as number, mode);

            gradient.splice(gradient.length, 0, ...rgbs.map((rgb) => this.#colorize.rgb(rgb.r, rgb.g, rgb.b)));
        }

        gradient.push(this.#colorize.rgb(...((this.stops.at(-1) as StopOutput).color as [number, number, number])));

        return gradient;
    }
}
