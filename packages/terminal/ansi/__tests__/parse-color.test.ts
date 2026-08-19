import { describe, expect, it } from "vitest";

import parseColor from "../src/parse-color";
import x11ColorToHex from "../src/x11-colors";

describe(parseColor, () => {
    it.each([
        ["rgb: full width", "rgb:ffff/0000/0000", { b: 0, g: 0, r: 255 }],
        ["rgb: single digit", "rgb:f/0/0", { b: 0, g: 0, r: 255 }],
        ["rgb: two digits", "rgb:ff/80/00", { b: 0, g: 128, r: 255 }],
        ["rgba: alpha ignored", "rgba:ffff/0000/0000/8000", { b: 0, g: 0, r: 255 }],
        ["#rgb", "#f00", { b: 0, g: 0, r: 255 }],
        ["#rrggbb", "#ff0000", { b: 0, g: 0, r: 255 }],
        ["#rrrrggggbbbb", "#ffff00000000", { b: 0, g: 0, r: 255 }],
        ["x11 name", "red", { b: 0, g: 0, r: 255 }],
        ["x11 name with space", "cornflower blue", { b: 237, g: 149, r: 100 }],
        ["x11 name camel case", "CornflowerBlue", { b: 237, g: 149, r: 100 }],
        ["surrounding space", "  #00ff00  ", { b: 0, g: 255, r: 0 }],
    ])("parses %s", (_name, spec, expected) => {
        expect.assertions(1);

        expect(parseColor(spec)).toStrictEqual(expected);
    });

    it.each([["empty", ""], ["not a colour", "definitely-not-a-colour"], ["truncated rgb", "rgb:ff/00"], ["bad hex", "#gg0000"], ["wrong digit count", "#ff00"]])(
        "returns undefined for %s",
        (_name, spec) => {
            expect.assertions(1);

            expect(parseColor(spec)).toBeUndefined();
        },
    );

    it("scales each channel by its own width, not by truncation", () => {
        expect.assertions(2);

        // X11 device specs are resolution-independent: `8` is mid-grey at one digit, and so is
        // `8888` at four. Truncating to the leading byte would give 0x88 for one of them.
        expect(parseColor("rgb:8/8/8")).toStrictEqual({ b: 136, g: 136, r: 136 });
        expect(parseColor("rgb:ffff/ffff/ffff")).toStrictEqual({ b: 255, g: 255, r: 255 });
    });
});

describe(x11ColorToHex, () => {
    it("resolves names case- and space-insensitively", () => {
        expect.assertions(3);

        expect(x11ColorToHex("AliceBlue")).toBe("#f0f8ff");
        expect(x11ColorToHex("alice blue")).toBe("#f0f8ff");
        expect(x11ColorToHex("ALICEBLUE")).toBe("#f0f8ff");
    });

    it("covers the numbered variants and modern additions", () => {
        expect.assertions(3);

        expect(x11ColorToHex("gray50")).toBeDefined();
        expect(x11ColorToHex("rebeccapurple")).toBe("#663399");
        expect(x11ColorToHex("yellowgreen")).toBe("#9acd32");
    });

    it("returns undefined for an unknown name", () => {
        expect.assertions(1);

        expect(x11ColorToHex("not a colour")).toBeUndefined();
    });
});
