import { describe, expect, it } from "vitest";

import { boxen } from "../../src";

describe("height option", () => {
    it("height option works", () => {
        expect.assertions(2);

        // Creates a tall box with empty rows
        expect(
            boxen("foo", {
                height: 5,
            }),
        ).toMatchSnapshot("height 5");

        // Creates a 1 line box, cropping the other lines
        expect(
            boxen("foo bar\nfoo bar", {
                height: 3,
            }),
        ).toMatchSnapshot("height 3");
    });

    it("height option with padding + margin", () => {
        expect.assertions(1);

        // Creates a wide box for little text
        const box = boxen("foo", {
            height: 20,
            margin: 2,
            padding: 1,
        });

        expect(box).toMatchSnapshot();
    });

    it("height option with width", () => {
        expect.assertions(1);

        // Creates a wide box for little text
        const box = boxen("foo", {
            height: 5,
            width: 20,
        });

        expect(box).toMatchSnapshot();
    });

    it("height option with width + padding + margin", () => {
        expect.assertions(1);

        // Creates a wide box for little text
        const box = boxen("foo", {
            height: 5,
            margin: 2,
            padding: 1,
            width: 20,
        });

        expect(box).toMatchSnapshot();
    });

    it("height option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
            height: 3,
        });

        expect(box).toMatchSnapshot();
    });

    it("drops vertical padding when it overflows a small height", () => {
        expect.assertions(1);

        // height (2) minus top+bottom padding (3 + 3) is <= 0, so padding.top/bottom
        // are reset to 0 to prevent overflow
        const box = boxen("foo", {
            height: 2,
            padding: {
                bottom: 3,
                left: 0,
                right: 0,
                top: 3,
            },
        });

        expect(box).toMatchSnapshot();
    });
});
