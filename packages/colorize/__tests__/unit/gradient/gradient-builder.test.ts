import { describe, expect, it } from "vitest";

import ColorizeImpl from "../../../src/colorize.server";
import { GradientBuilder } from "../../../src/gradient/gradient-builder";
import type { ColorizeType } from "../../../src/types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

describe("gradient", () => {
    it("should reverse gradient", () => {
        expect.assertions(1);

        const grad1 = new GradientBuilder(colorize, ["red", "green", "blue", "yellow", "black"]);
        const grad2 = grad1.reverse();

        // eslint-disable-next-line etc/no-assign-mutated-array
        expect(grad1.stops.map((stop) => stop.color)).toStrictEqual(grad2.stops.reverse().map((stop) => stop.color));
    });

    it("should generate 11 steps gradient from black to grey in RGB", () => {
        expect.assertions(4);

        const grad = new GradientBuilder(colorize, [
            [0, 0, 0],
            [100, 100, 100],
        ]);

        const result = grad.rgb(11);

        expect(result).toHaveLength(11);
        expect(JSON.stringify(result[0])).toStrictEqual(JSON.stringify(colorize.rgb(0, 0, 0)));
        expect(JSON.stringify(result[5])).toStrictEqual(JSON.stringify(colorize.rgb(50, 50, 50)));
        expect(JSON.stringify(result[10])).toStrictEqual(JSON.stringify(colorize.rgb(100, 100, 100)));
    });

    it("should loop a gradient", () => {
        expect.assertions(5);

        const grad = new GradientBuilder(colorize, [
            { b: 0, g: 0, r: 0 },
            { b: 255, g: 255, r: 255 },
        ]);
        const result = grad.loop().rgb(5);

        expect(result).toHaveLength(5);
        expect(JSON.stringify(result[0])).toStrictEqual(JSON.stringify(colorize.rgb(0, 0, 0)));
        expect(JSON.stringify(result[2])).toStrictEqual(JSON.stringify(colorize.rgb(255, 255, 255)));
        expect(JSON.stringify(result[0])).toStrictEqual(JSON.stringify(result[4]));
        expect(JSON.stringify(result[1])).toStrictEqual(JSON.stringify(result[3]));
    });

    it("should allow positionned stops", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            { color: "black", position: 0 },
            { color: "white", position: 0.5 },
        ]);

        expect(JSON.stringify(grad.rgb(5))).toStrictEqual(
            JSON.stringify([
                colorize.rgb(0, 0, 0),
                colorize.rgb(128, 128, 128),
                colorize.rgb(255, 255, 255),
                colorize.rgb(255, 255, 255),
                colorize.rgb(255, 255, 255),
            ]),
        );
    });

    it("should allow position only stops", () => {
        expect.assertions(2);

        const grad1 = new GradientBuilder(colorize, [
            { color: "black", position: 0 },
            { color: "white", position: 1 },
        ]);

        expect(grad1.rgb(5).map((color) => color.open + color.close)).toStrictEqual([
            "[38;2;0;0;0m[39m",
            "[38;2;63;63;63m[39m",
            "[38;2;127;127;127m[39m",
            "[38;2;191;191;191m[39m",
            "[38;2;255;255;255m[39m",
        ]);

        // with position stop
        const grad2 = new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }, { color: "white", position: 1 }]);

        expect(grad2.rgb(5).map((color) => color.open + color.close)).toStrictEqual([
            "[38;2;0;0;0m[39m",
            "[38;2;127;127;127m[39m",
            "[38;2;169;169;169m[39m",
            "[38;2;212;212;212m[39m",
            "[38;2;255;255;255m[39m",
        ]);
    });

    it("should prevent consecutive position stops", () => {
        expect.assertions(3);

        expect(() => {
            // eslint-disable-next-line no-new
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }, { position: 0.4 }, { color: "white", position: 1 }]);
        }).toThrow("Cannot define two consecutive position-only stops");

        expect(() => {
            // eslint-disable-next-line no-new
            new GradientBuilder(colorize, [{ position: 0.4 }, { color: "white", position: 1 }]);
        }).toThrow("Cannot define two consecutive position-only stops");

        expect(() => {
            // eslint-disable-next-line no-new
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }]);
        }).toThrow("Cannot define two consecutive position-only stops");
    });

    it("should prevent misordered stops", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new
            new GradientBuilder(colorize, [
                { color: "black", position: 0.5 },
                { color: "white", position: 0 },
            ]);
        }).toThrow("Color stops positions are not ordered");
    });

    it("should allow equal position stops", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            { color: "black", position: 0 },
            { color: "white", position: 0.5 },
            { color: "black", position: 0.5 },
            { color: "white", position: 1 },
        ]);

        expect(grad.rgb(8).map((color) => color.open + color.close)).toStrictEqual([
            "[38;2;0;0;0m[39m",
            "[38;2;85;85;85m[39m",
            "[38;2;170;170;170m[39m",
            "[38;2;255;255;255m[39m",
            "[38;2;0;0;0m[39m",
            "[38;2;85;85;85m[39m",
            "[38;2;170;170;170m[39m",
            "[38;2;255;255;255m[39m",
        ]);
    });

    it("should force RGB interpolation when a color is grey", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            [86, 86, 86],
            [45, 163, 185],
        ]);

        expect(grad.hsv(5).map((color) => color.open + color.close)).toStrictEqual(grad.rgb(5).map((color) => color.open + color.close));
    });
});
