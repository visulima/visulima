import { describe, expect, it } from "vitest";

import ColorizeImpl from "../../../src/colorize.server";
import { GradientBuilder } from "../../../src/gradient/gradient-builder";

const colorize = new ColorizeImpl();

describe("gradient", () => {
    it("should reverse gradient", () => {
        expect.assertions(1);

        const grad1 = new GradientBuilder(colorize, ["red", "green", "blue", "yellow", "black"]);
        // eslint-disable-next-line unicorn/no-array-reverse -- GradientBuilder.reverse() is not Array#reverse()
        const grad2 = grad1.reverse();

        expect(grad1.stops.map((stop) => stop.color)).toStrictEqual(grad2.stops.toReversed().map((stop) => stop.color));
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
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }, { position: 0.4 }, { color: "white", position: 1 }]);
        }).toThrow("Cannot define two consecutive position-only stops");

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [{ position: 0.4 }, { color: "white", position: 1 }]);
        }).toThrow("Cannot define two consecutive position-only stops");

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }]);
        }).toThrow("Cannot define two consecutive position-only stops");
    });

    it("should prevent misordered stops", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
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

    it("should throw when fewer than two stops are given", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, ["red"]);
        }).toThrow("Invalid number of stops (< 2)");
    });

    it("should throw when mixing positioned and non-positioned stops", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [{ color: "red", position: 0 }, "blue"]);
        }).toThrow("Cannot mix positioned and non-positioned color stops");
    });

    it("should throw when a positioned stop is out of range", () => {
        expect.assertions(2);

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [
                { color: "red", position: -0.1 },
                { color: "blue", position: 1 },
            ]);
        }).toThrow("Color stops positions must be between 0 and 1");

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [
                { color: "red", position: 0 },
                { color: "blue", position: 1.5 },
            ]);
        }).toThrow("Color stops positions must be between 0 and 1");
    });

    it("should throw for an invalid color stop", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line no-new,sonarjs/constructor-for-side-effects
            new GradientBuilder(colorize, [{}, {}] as never);
        }).toThrow("Invalid color stop");
    });

    it("should accept hex and rgb-object positioned stops", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            { color: "#ff0000", position: 0 },
            { color: { b: 255, g: 0, r: 0 }, position: 1 },
        ]);

        expect(grad.stops.map((stop) => stop.color)).toStrictEqual([
            [255, 0, 0],
            [0, 0, 255],
        ]);
    });

    it("should accept rgb-object non-positioned stops", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            { b: 0, g: 0, r: 255 },
            { b: 255, g: 0, r: 0 },
        ]);

        expect(grad.stops.map((stop) => stop.color)).toStrictEqual([
            [255, 0, 0],
            [0, 0, 255],
        ]);
    });

    it("should accept hex-string non-positioned stops", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, ["#ff0000", "#0000ff"]);

        expect(grad.stops.map((stop) => stop.color)).toStrictEqual([
            [255, 0, 0],
            [0, 0, 255],
        ]);
    });

    it("should pad positioned stops that do not start at 0 or end at 1", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [
            { color: "red", position: 0.2 },
            { color: "blue", position: 0.8 },
        ]);

        expect(grad.stops.map((stop) => stop.position)).toStrictEqual([0, 0.2, 0.8, 1]);
    });

    it("should interpolate color-less stops in HSV mode", () => {
        expect.assertions(1);

        const grad = new GradientBuilder(colorize, [{ color: "red", position: 0 }, { position: 0.5 }, { color: "blue", position: 1 }]);

        expect(grad.hsv(5).map((color) => color.open)).toStrictEqual([
            "[38;2;255;0;0m",
            "[38;2;255;255;0m",
            "[38;2;0;255;0m",
            "[38;2;0;255;255m",
            "[38;2;0;0;255m",
        ]);
    });
});
