import { describe, expect, it } from "vitest";

import { boxen } from "../src";

describe("padding option", () => {
    it("width option works", () => {
        expect.assertions(2);

        // Creates a wide box for little text
        expect(
            boxen("foo", {
                width: 20,
            }),
        ).toMatchSnapshot();

        // Creates a small box for a lot of text
        expect(
            boxen("foo bar foo bar", {
                width: 10,
            }),
        ).toMatchSnapshot();
    });

    it("width option with padding + margin", () => {
        expect.assertions(1);

        // Creates a wide box for little text
        const box = boxen("foo", {
            width: 20,
            margin: 2,
            padding: 1,
        });

        expect(box).toMatchSnapshot();
    });

    it("width option with big padding", () => {
        expect.assertions(1);

        // Should disable the paddings
        const box = boxen("foo", {
            width: 6,
            padding: 3,
        });

        expect(box).toMatchSnapshot();
    });

    it("width option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            width: 3,
            borderStyle: "none",
        });

        expect(box).toMatchSnapshot();
    });
});
