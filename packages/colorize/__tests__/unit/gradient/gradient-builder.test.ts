import { describe, expect, it } from "vitest";

import ColorizeImpl from "../../../src/colorize.server";
import { GradientBuilder } from "../../../src/gradient/gradient-builder";
import type { ColorizeType } from "../../../src/types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

describe("gradient", () => {
    // it("should throw an error on invalid steps/colors number", () => {
    //     expect.assertions(4);
    //
    //     expect(() => {
    //         tinygradient("red");
    //     }).toThrow();
    //
    //     expect(() => {
    //         tinygradient(["red"]);
    //     }).toThrow();
    //
    //     expect(() => {
    //         const grad = tinygradient("red", "blue");
    //         grad.rgb(1);
    //     }).toThrow();
    //
    //     expect(() => {
    //         const grad = tinygradient("red", "blue", "green");
    //         grad.rgb(2);
    //     }).toThrow();
    // });

    it("should reverse gradient", () => {
        expect.assertions(1);

        const grad1 = new GradientBuilder(colorize, ["red", "green", "blue", "yellow", "black"]);
        const grad2 = grad1.reverse();

        expect(grad1.stops).toStrictEqual(grad2.stops.reverse());
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
        // reference
        const grad1 = new GradientBuilder(colorize, [
            { color: "black", position: 0 },
            { color: "white", position: 1 },
        ]);

        assert.deepStrictEqual(
            grad1.rgb(5).map((c) => c.toHex()),
            ["000000", "404040", "808080", "bfbfbf", "ffffff"],
        );

        // with position stop
        const grad2 = new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }, { color: "white", position: 1 }]);

        assert.deepStrictEqual(
            grad2.rgb(5).map((c) => c.toHex()),
            ["000000", "808080", "aaaaaa", "d5d5d5", "ffffff"],
        );
    });

    it("should prevent consecutive position stops", () => {
        assert.throws(() => {
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }, { position: 0.4 }, { color: "white", position: 1 }]);
        });
        assert.throws(() => {
            new GradientBuilder(colorize, [{ position: 0.4 }, { color: "white", position: 1 }]);
        });
        assert.throws(() => {
            new GradientBuilder(colorize, [{ color: "black", position: 0 }, { position: 0.2 }]);
        });
    });

    it("should prevent misordered stops", () => {
        assert.throws(() => {
            new GradientBuilder(colorize, [
                { color: "black", position: 0.5 },
                { color: "white", position: 0 },
            ]);
        });
    });

    it("should allow equal position stops", () => {
        const grad = new GradientBuilder(colorize, [
            { color: "black", position: 0 },
            { color: "white", position: 0.5 },
            { color: "black", position: 0.5 },
            { color: "white", position: 1 },
        ]);

        assert.deepStrictEqual(
            grad.rgb(8).map((c) => c.toHex()),
            ["000000", "555555", "aaaaaa", "ffffff", "000000", "555555", "aaaaaa", "ffffff"],
        );
    });

    it("should force RGB interpolation when a color is grey", () => {
        const grad = new GradientBuilder(colorize, "rgba(86, 86, 86)", "rgb(45, 163, 185)");

        assert.deepStrictEqual(
            grad.hsv(5).map((c) => c.toHex()),
            grad.rgb(5).map((c) => c.toHex()),
        );
    });
});
