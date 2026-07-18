import { describe, expect, it } from "vitest";

import { boxen } from "../../src";

describe("margin option", () => {
    it("margin option works", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            margin: 2,
        });

        expect(box).toMatchSnapshot();
    });

    it("margin option with custom margins", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            margin: {
                bottom: 4,
                left: 2,
                right: 3,
                top: 1,
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("margin option with padding", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            margin: 1,
            padding: 1,
        });

        expect(box).toMatchSnapshot();
    });

    it("margin proportionally decreases when content <= columns", () => {
        expect.assertions(3);

        // Plenty space
        let box = boxen("x".repeat(Number(process.env.COLUMNS) / 2 - 2), {
            margin: 2,
        });

        expect(box).toMatchSnapshot("columns / 2 - 2");

        // A bit of space
        box = boxen("x".repeat(Number(process.env.COLUMNS) - 6 - 2), {
            margin: 2,
        });

        expect(box).toMatchSnapshot("columns - 6 - 2");

        // No room
        box = boxen("ax".repeat(Number(process.env.COLUMNS) - 2), {
            margin: 2,
        });

        expect(box).toMatchSnapshot("columns - 2");
    });

    it("clamps a negative margin number to zero instead of throwing", () => {
        expect.assertions(2);

        expect(() => boxen("foo", { margin: -1 })).not.toThrow();
        expect(boxen("foo", { margin: -1 })).toBe(boxen("foo", { margin: 0 }));
    });

    it("clamps negative margin sides to zero", () => {
        expect.assertions(1);

        expect(boxen("foo", { margin: { bottom: -2, left: -3, right: 1, top: 0 } })).toBe(boxen("foo", { margin: { bottom: 0, left: 0, right: 1, top: 0 } }));
    });

    it("margin option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
            margin: {
                bottom: 1,
                left: 1,
                right: 1,
                top: 1,
            },
        });

        expect(box).toMatchSnapshot();
    });
});
