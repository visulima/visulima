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
