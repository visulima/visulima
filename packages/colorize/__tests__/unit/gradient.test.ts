import { describe, expect, it } from "vitest";

import { gradient } from "../../src/gradient";

describe(gradient, () => {
    it("should generate a gradient for a string", () => {
        expect.assertions(6);

        expect(gradient(["blue", "white", "red"])("Hello, World!")).toBe(
            "[38;2;0;0;255mH[39m[38;2;51;51;255me[39m[38;2;102;102;255ml[39m[38;2;153;153;255ml[39m[38;2;204;204;255mo[39m[38;2;255;255;255m,[39m [38;2;255;212;212mW[39m[38;2;255;170;170mo[39m[38;2;255;127;127mr[39m[38;2;255;85;85ml[39m[38;2;255;42;42md[39m[38;2;255;0;0m![39m",
        );

        // Red -> yellow -> green (short arc)
        expect(gradient(["red", "green"])("abc")).toBe("[38;2;255;0;0ma[39m[38;2;127;64;0mb[39m[38;2;0;128;0mc[39m");
        expect(gradient(["red", "green"], { interpolation: "hsv" })("abc")).toBe("[38;2;255;0;0ma[39m[38;2;191;192;0mb[39m[38;2;0;128;0mc[39m");

        // Red -> blue -> green (long arc)
        expect(gradient(["red", "green"])("abc")).toBe("[38;2;255;0;0ma[39m[38;2;127;64;0mb[39m[38;2;0;128;0mc[39m");
        expect(gradient(["red", "green"], { hsvSpin: "long", interpolation: "hsv" })("abc")).toBe("[38;2;255;0;0ma[39m[38;2;0;0;192mb[39m[38;2;0;128;0mc[39m");
        expect(gradient(["red", "green"], { hsvSpin: "short", interpolation: "hsv" })("abc")).toBe(
            "[38;2;255;0;0ma[39m[38;2;191;192;0mb[39m[38;2;0;128;0mc[39m",
        );
    });

    it("should generate a gradient for a multi line string", () => {
        expect.assertions(1);

        expect(gradient(["red", "green"])("hello\nworld")).toBe(
            `[38;2;255;0;0mh[39m[38;2;226;14;0me[39m[38;2;198;28;0ml[39m[38;2;170;42;0ml[39m[38;2;141;56;0mo[39m\n[38;2;113;71;0mw[39m[38;2;85;85;0mo[39m[38;2;56;99;0mr[39m[38;2;28;113;0ml[39m[38;2;0;128;0md[39m`,
        );
    });
});
