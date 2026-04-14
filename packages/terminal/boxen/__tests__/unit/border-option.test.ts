import { blue, green, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { boxen } from "../../src";

describe("border option", () => {
    it("should support border color (red)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderColor: (border: string) => red(border),
        });

        expect(box).toMatchSnapshot();
    });

    it("should support multi border color (red)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderColor: (border, position): string => {
                if (position === "top") {
                    return red(border);
                }

                if (position === "left") {
                    return yellow(border);
                }

                if (position === "right") {
                    return green(border);
                }

                return blue(border);
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("throws on unexpected borderColor", () => {
        expect.assertions(1);

        expect(() => {
            // @ts-ignore - intentional error for testing
            boxen("foo", { borderColor: "greasy-white" });
        }).toThrow("\"borderColor\" is not a valid function");
    });

    it("border style (single)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "single",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (singleDouble)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "singleDouble",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (doubleSingle)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "doubleSingle",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (double)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "double",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (classic)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "classic",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (bold)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "bold",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (round)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "round",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (custom ascii style)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: {
                bottom: "_",
                bottomLeft: "3",
                bottomRight: "4",
                left: "|",
                right: "!",
                top: "-",
                topLeft: "1",
                topRight: "2",
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("throws on unexpected borderStyle as string", () => {
        expect.assertions(1);

        expect(() => {
            // @ts-ignore - intentional error for testing
            boxen("foo", { borderStyle: "shakenSnake" });
        }).toThrow("s");
    });
});
