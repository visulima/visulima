import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boxen } from "../src";

describe("float option", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("float option (left)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            float: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (center)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            float: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (right)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            float: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (center) with margin", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            float: "right",
            margin: {
                left: 3,
                top: 4,
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (right) with margin", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            float: "right",
            margin: {
                bottom: 5,
                right: 2,
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (center) when content > columns", () => {
        expect.assertions(2);

        const longContent = "foobar".repeat(Number(process.env["COLUMNS"]));

        expect(() => {
            boxen(longContent, {
                float: "center",
            });
        }).not.toThrow();

        const box = boxen(longContent, {
            float: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("float option (right) when content > columns", () => {
        expect.assertions(2);

        const longContent = "foobar".repeat(Number(process.env["COLUMNS"]));

        expect(() => {
            boxen(longContent, {
                float: "right",
            });
        }).not.toThrow();

        const box = boxen(longContent, {
            float: "right",
        });

        expect(box).toMatchSnapshot();
    });
});
