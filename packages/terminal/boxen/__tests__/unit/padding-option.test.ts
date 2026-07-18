import { describe, expect, it } from "vitest";

import { boxen } from "../../src";

describe("padding option", () => {
    it("padding option works", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            padding: 2,
        });

        expect(box).toMatchSnapshot();
    });

    it("padding option advanced", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            padding: {
                bottom: 2,
                left: 5,
                right: 10,
                top: 0,
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("clamps a negative padding number to zero instead of throwing", () => {
        expect.assertions(2);

        expect(() => boxen("foo", { padding: -1 })).not.toThrow();
        expect(boxen("foo", { padding: -1 })).toBe(boxen("foo", { padding: 0 }));
    });

    it("clamps negative padding sides to zero", () => {
        expect.assertions(1);

        expect(boxen("foo", { padding: { bottom: -2, left: -3, right: 1, top: 0 } })).toBe(boxen("foo", { padding: { bottom: 0, left: 0, right: 1, top: 0 } }));
    });

    it("padding option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
            padding: {
                bottom: 1,
                left: 1,
                right: 1,
                top: 1,
            },
        });

        expect(box).toMatchSnapshot();
    });
});
