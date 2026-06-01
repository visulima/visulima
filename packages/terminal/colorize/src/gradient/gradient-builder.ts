import type { ColorizeType, ColorValueHex, CssColorName, RGB, StopInput, StopOutput } from "../types";
import { convertHexToRgb } from "../util/convert-hex-to-rgb";
import { colorNames } from "./util/color-names";
import { computeSubSteps } from "./util/compute";
import { interpolateHsv, interpolateRgb } from "./util/interpolate";

// eslint-disable-next-line import/prefer-default-export -- public API uses named export
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

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        const havingPositions = (stops[0] as StopInput).position !== undefined;

        let l = stops.length;
        let p = -1;
        let lastColorLess = false;

        // eslint-disable-next-line @typescript-eslint/naming-convention
        for (const [index, stop_] of stops.entries()) {
            let stop: StopOutput;

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
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
                        color = stopInput.color;
                    } else if (typeof stopInput.color === "string") {
                        color = stopInput.color.includes("#") ? convertHexToRgb(stopInput.color) : colorNames[stopInput.color as CssColorName];
                    } else if (stopInput.color && "r" in stopInput.color && "g" in stopInput.color && "b" in stopInput.color) {
                        color = [stopInput.color.r, stopInput.color.g, stopInput.color.b];
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
                    color: stop_,
                    position: index / (l - 1),
                };
            } else if (typeof stop_ === "string") {
                stop = {
                    color: stop_.includes("#") ? convertHexToRgb(stop_) : colorNames[stop_ as CssColorName],
                    position: index / (l - 1),
                };
            } else if (
                (stop_ as RGB | undefined)?.r !== undefined &&
                (stop_ as RGB | undefined)?.g !== undefined &&
                (stop_ as RGB | undefined)?.b !== undefined
            ) {
                stop = {
                    color: [(stop_ as RGB).r, (stop_ as RGB).g, (stop_ as RGB).b],
                    position: index / (l - 1),
                };
            } else {
                throw new Error("Invalid color stop");
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
