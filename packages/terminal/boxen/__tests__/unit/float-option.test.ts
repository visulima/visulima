import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boxen } from "../../src";

vi.mock(import("terminal-size"), () => {
    return {
        default: () => {
            return {
                columns: 80,
                rows: 24,
            };
        },
    };
});

describe("float option", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
            stderr: {
                rows: 24,
            },
            stdout: {
                columns: 80,
            },
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

        const longContent = "foobar".repeat(22);

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

        const longContent = "foobar".repeat(22);

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
