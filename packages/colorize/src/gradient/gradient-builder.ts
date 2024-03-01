import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput, StopOutput } from "../types";
import { hexToRgb } from "../util/hex-to-rgb";
import { colorNames } from "./util/color-names";
import { computeSubSteps } from "./util/compute";
import { interpolateHsv, interpolateRgb } from "./util/interpolate";

export class GradientBuilder {
    readonly #colorize: ColorizeType;

    public readonly stops: StopOutput[];

    // eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/no-redundant-type-constituents
    public constructor(colorize: ColorizeType, stops: (ColorValueHex | CssColorName | RGB | StopInput | [number, number, number])[]) {
        this.#colorize = colorize;
        this.stops = [];

        if (stops.length < 2) {
            throw new Error("Invalid number of stops (< 2)");
        }

        const havingPositions = stops[0].position !== undefined;
        let l = stops.length;
        let p = -1;
        let lastColorLess = false;

        // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/naming-convention,no-restricted-syntax
        for (const [index, stop_] of stops.entries()) {
            if (stop_ === undefined) {
                throw new Error("Invalid color stop");
            }

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
                        color = stopInput.color.includes("#") ? hexToRgb(stopInput.color as ColorValueHex) : colorNames[stopInput.color as CssColorName];
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
                    color: stop_.includes("#") ? hexToRgb(stop_ as ColorValueHex) : colorNames[stop_ as CssColorName],
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

        if (this.stops[0].position !== 0) {
            this.stops.unshift({
                color: this.stops[0].color,
                position: 0,
            });

            l++;
        }

        if (this.stops[l - 1].position !== 1) {
            this.stops.push({
                color: this.stops[l - 1].color,
                position: 1,
            });
        }
    }

    public reverse(): GradientBuilder {
        const stops: StopInput[] = [];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const stop of this.stops) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const stop_ = { ...stop };

            stop_.position = 1 - stop.position;

            stops.push(stop_);
        }

        // eslint-disable-next-line etc/no-assign-mutated-array
        return new GradientBuilder(this.#colorize, stops.reverse());
    }

    public loop(): GradientBuilder {
        const stops1: StopInput[] = [];
        const stops2: StopInput[] = [];

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const stop of this.stops) {
            stops1.push({
                color: stop.color,
                position: (stop.position ?? 0) / 2,
            });
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const stop of this.stops.slice(0, -1)) {
            stops2.push({
                color: stop.color,
                position: 1 - (stop.position ?? 0) / 2,
            });
        }

        // eslint-disable-next-line etc/no-assign-mutated-array
        return new GradientBuilder(this.#colorize, [...stops1, ...stops2.reverse()]);
    }

    public rgb(steps: number): ColorizeType[] {
        const subSteps = computeSubSteps(this.stops, steps);
        const gradient: ColorizeType[] = [];

        this.stops.forEach((stop, index) => {
            if (stop.colorLess) {
                // eslint-disable-next-line no-param-reassign
                stop.color = interpolateRgb(this.#colorize, this.stops[index - 1] as StopOutput, this.stops[index + 1] as StopOutput, 2)[1];
            }
        });

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 0, l = this.stops.length; index < l - 1; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const rgb = interpolateRgb(this.#colorize, this.stops[index] as StopOutput, this.stops[index + 1] as StopOutput, subSteps[index] as number);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            gradient.splice(gradient.length, 0, ...rgb);
        }

        gradient.push(this.#colorize.rgb(...this.stops.at(-1).color));

        return gradient;
    }

    public hsv(steps: number, mode?: boolean | "long" | "short"): ColorizeType[] {
        const subSteps = computeSubSteps(this.stops, steps);
        const gradient: ColorizeType[] = [];

        this.stops.forEach((stop, index) => {
            if (stop.colorLess) {
                stop.color = interpolateHsv(this.#colorize, this.stops[index - 1], this.stops[index + 1], 2, mode)[1];
            }
        });

        for (let index = 0, l = this.stops.length; index < l - 1; index++) {
            const hsv = interpolateHsv(this.#colorize, this.stops[index], this.stops[index + 1], subSteps[index], mode);

            gradient.splice(gradient.length, 0, ...hsv);
        }

        gradient.push(this.#colorize.rgb(...this.stops.at(-1).color));

        return gradient;
    }
}
