import type { ColorSupportLevel } from "@visulima/is-ansi-color-supported";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ColorData } from "../../src/types";

type AnsiCodesModule = typeof import("../../src/ansi-codes");

const loadWithLevel = async (level: ColorSupportLevel): Promise<AnsiCodesModule> => {
    vi.resetModules();

    vi.doMock(import("@visulima/is-ansi-color-supported"), async (importOriginal) => {
        const actual = await importOriginal();

        return {
            ...actual,
            isStdoutColorSupported: () => level,
        };
    });

    return import("../../src/ansi-codes");
};

describe("ansi-codes color level resolution", () => {
    afterEach(() => {
        vi.doUnmock("@visulima/is-ansi-color-supported");
        vi.resetModules();
    });

    it("should emit no escape codes when color is unsupported (level 0)", async () => {
        expect.assertions(3);

        const { baseColors, baseStyles, styleMethods } = await loadWithLevel(0);

        expect(baseColors.red).toStrictEqual<ColorData>({ close: "", open: "" });
        expect(baseStyles.bold).toStrictEqual<ColorData>({ close: "", open: "" });
        expect(styleMethods.rgb(10, 20, 30)).toStrictEqual<ColorData>({ close: "", open: "" });
    });

    it("should downsample to the ANSI 16 color space (level 1)", async () => {
        expect.assertions(6);

        const { styleMethods } = await loadWithLevel(1);

        expect(styleMethods.rgb(10, 20, 30).open).toBe("[30m");
        expect(styleMethods.fg(97).open).toBe("[34m");
        expect(styleMethods.hex("#ff0000").open).toBe("[91m");
        expect(styleMethods.bg(97).open).toBe("[44m");
        expect(styleMethods.bgRgb(10, 20, 30).open).toBe("[40m");
        expect(styleMethods.bgHex("#ff0000").open).toBe("[101m");
    });

    it("should downsample to the ANSI 256 color space (level 2)", async () => {
        expect.assertions(3);

        const { styleMethods } = await loadWithLevel(2);

        expect(styleMethods.rgb(10, 20, 30).open).toBe("[38;5;17m");
        expect(styleMethods.fg(97).open).toBe("[38;5;97m");
        expect(styleMethods.hex("#ff0000").open).toBe("[38;5;196m");
    });

    it("should emit TrueColor escape codes (level 3)", async () => {
        expect.assertions(3);

        const { styleMethods } = await loadWithLevel(3);

        expect(styleMethods.rgb(10, 20, 30).open).toBe("[38;2;10;20;30m");
        expect(styleMethods.fg(97).open).toBe("[38;5;97m");
        expect(styleMethods.hex("#ff0000").open).toBe("[38;2;255;0;0m");
    });
});
