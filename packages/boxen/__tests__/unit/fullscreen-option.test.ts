import { describe, expect, it, vi } from "vitest";

import { boxen } from "../../src";

vi.mock("terminal-size", () => {
    return {
        default: () => {
            return {
                columns: 80,
                rows: 24,
            };
        },
    };
});

describe("fullscreen option", () => {
    it("fullscreen option", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            fullscreen: true,
        });

        expect(box).toMatchSnapshot();
    });

    it("fullscreen option + width", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            fullscreen: true,
            width: 10,
        });

        expect(box).toMatchSnapshot();
    });

    it("fullscreen option + height", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            fullscreen: true,
            height: 10,
        });

        expect(box).toMatchSnapshot();
    });

    it("fullscreen option with callback", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            fullscreen: (width, height) => [width - 2, height - 2],
        });

        expect(box).toMatchSnapshot();
    });
});
