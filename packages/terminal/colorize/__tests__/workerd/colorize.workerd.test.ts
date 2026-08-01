import { describe, expect, it } from "vitest";

import Colorize, { stderrColorLevel, stdoutColorLevel } from "../../src/colorize.server";
import { gradient } from "../../src/gradient";
import browserColorize, { bold as browserBold, red as browserRed } from "../../src/index.browser";
import colorize, { bold, green, hex, red, rgb, strip, underline } from "../../src/index.server.mts";
import template, { makeTaggedTemplate } from "../../src/template";
import type { ColorizeType } from "../../src/types";
import { convertHexToRgb, rgbToAnsi256 } from "../../src/utils";

const truecolor: ColorizeType = new Colorize({ level: 3 });
const ansi256: ColorizeType = new Colorize({ level: 2 });
const ansi16: ColorizeType = new Colorize({ level: 1 });
const mono: ColorizeType = new Colorize({ level: 0 });

describe("colorize import-time detection (workerd)", () => {
    it("should detect a mono level for stdout and stderr on bare workerd", () => {
        expect.assertions(2);

        // workerd exposes `process.env` but no TTY streams and no TERM, so detection
        // must land on level 0 rather than throwing while probing `process.stdout`.
        expect(stdoutColorLevel).toBe(0);
        expect(stderrColorLevel).toBe(0);
    });

    it("should emit plain text from the auto-detected singleton", () => {
        expect.assertions(3);

        expect(colorize.red("error")).toBe("error");
        expect(red.bold("error")).toBe("error");
        expect(bold`error ${green("here")}`).toBe("error here");
    });
});

describe("colorize public API at every level (workerd)", () => {
    it("should style a single color at truecolor", () => {
        expect.assertions(2);

        expect(truecolor.red("foo")).toBe("\u001B[31mfoo\u001B[39m");
        expect(truecolor.bold("foo")).toBe("\u001B[1mfoo\u001B[22m");
    });

    it("should chain styles at truecolor", () => {
        expect.assertions(1);

        expect(truecolor.red.bold.underline("foo")).toBe("\u001B[31m\u001B[1m\u001B[4mfoo\u001B[24m\u001B[22m\u001B[39m");
    });

    it("should re-open the outer style after a nested close", () => {
        expect.assertions(1);

        expect(truecolor.red(`a ${truecolor.green("b")} c`)).toBe("\u001B[31ma \u001B[32mb\u001B[31m c\u001B[39m");
    });

    it("should render tagged templates at truecolor", () => {
        expect.assertions(1);

        expect(truecolor.green`foo ${truecolor.red`bar`}`).toBe("\u001B[32mfoo \u001B[31mbar\u001B[32m\u001B[39m");
    });

    it("should re-open styles across newlines at truecolor", () => {
        expect.assertions(1);

        expect(truecolor.red("a\nb")).toBe("\u001B[31ma\u001B[39m\n\u001B[31mb\u001B[39m");
    });

    it("should downgrade hex per level", () => {
        expect.assertions(4);

        expect(truecolor.hex("#FF0000")("foo")).toBe("\u001B[38;2;255;0;0mfoo\u001B[39m");
        expect(ansi256.hex("#FF0000")("foo")).toBe("\u001B[38;5;196mfoo\u001B[39m");
        expect(ansi16.hex("#FF0000")("foo")).toBe("\u001B[91mfoo\u001B[39m");
        expect(mono.hex("#FF0000")("foo")).toBe("foo");
    });

    it("should downgrade ansi256 per level", () => {
        expect.assertions(3);

        expect(ansi256.ansi256(93)("foo")).toBe("\u001B[38;5;93mfoo\u001B[39m");
        expect(ansi16.ansi256(93)("foo")).toBe("\u001B[94mfoo\u001B[39m");
        expect(mono.ansi256(93)("foo")).toBe("foo");
    });

    it("should emit no escape codes at level 0", () => {
        expect.assertions(3);

        expect(mono.red.bold("foo")).toBe("foo");
        expect(mono.rgb(1, 2, 3)("foo")).toBe("foo");
        expect(mono.bgRed`foo`).toBe("foo");
    });

    it("should keep instances isolated from each other", () => {
        expect.assertions(2);

        expect(new Colorize({ level: 3 }).red("x")).toBe("\u001B[31mx\u001B[39m");
        expect(new Colorize({ level: 0 }).red("x")).toBe("x");
    });
});

describe("colorize string handling without Buffer (workerd)", () => {
    it("should not touch the Buffer global while styling", () => {
        expect.assertions(2);

        const globalScope = globalThis as { Buffer?: unknown };
        const original = globalScope.Buffer;

        // Deleting `Buffer` proves the styling path is pure-string and never reaches
        // for a Node polyfill — a worker can run without the `nodejs_compat` flag.
        Reflect.deleteProperty(globalScope, "Buffer");

        try {
            expect(truecolor.red.bold("foo")).toBe("\u001B[31m\u001B[1mfoo\u001B[22m\u001B[39m");
            expect(strip("\u001B[31mfoo\u001B[39m")).toBe("foo");
        } finally {
            globalScope.Buffer = original;
        }
    });

    it("should preserve astral and combining characters", () => {
        expect.assertions(2);

        expect(truecolor.red("héllo 🎉 日本語")).toBe("\u001B[31mhéllo 🎉 日本語\u001B[39m");
        expect(strip(truecolor.red("héllo 🎉 日本語"))).toBe("héllo 🎉 日本語");
    });

    it("should coerce non-string input without Node coercion helpers", () => {
        expect.assertions(3);

        expect(truecolor.red(0 as unknown as string)).toBe("\u001B[31m0\u001B[39m");
        expect(truecolor.red(["a", "b"] as unknown as string)).toBe("\u001B[31ma,b\u001B[39m");
        expect(truecolor.red("")).toBe("");
    });
});

describe("colorize strip (workerd)", () => {
    it("should strip nested and chained sequences", () => {
        expect.assertions(2);

        expect(strip(truecolor.red.bold.underline("foo"))).toBe("foo");
        expect(colorize.strip("\u001B[38;2;255;0;0mfoo\u001B[39m")).toBe("foo");
    });

    it("should leave plain text untouched", () => {
        expect.assertions(1);

        expect(strip("plain")).toBe("plain");
    });
});

describe("colorize named exports (workerd)", () => {
    it("should expose the documented named exports", () => {
        expect.assertions(4);

        expect(red).toBeTypeOf("function");
        expect(underline).toBeTypeOf("function");
        expect(hex).toBeTypeOf("function");
        expect(rgb).toBeTypeOf("function");
    });
});

describe("colorize subpath entries (workerd)", () => {
    it("should render the tagged template at a forced level", () => {
        expect.assertions(2);

        const tagged = makeTaggedTemplate(truecolor);

        expect(tagged`{bold.red hello}`).toBe("\u001B[1m\u001B[31mhello\u001B[39m\u001B[22m");
        // The default `./template` export is bound to the auto-detected level, which is 0 here.
        expect(template`{bold.red hello}`).toBe("hello");
    });

    it("should build a gradient without a terminal", () => {
        expect.assertions(2);

        const rendered = gradient(["#FF0000", "#0000FF"])("abc");

        expect(rendered).toBeTypeOf("string");
        expect(strip(rendered)).toBe("abc");
    });

    it("should expose the color conversion utils", () => {
        expect.assertions(2);

        expect(convertHexToRgb("#FF0000")).toStrictEqual([255, 0, 0]);
        expect(rgbToAnsi256(255, 0, 0)).toBe(196);
    });
});

describe("colorize browser entry (workerd)", () => {
    it("should resolve and emit console CSS directives", () => {
        expect.assertions(3);

        // The browser build always renders `%c` + CSS pairs for `console.log(...)`;
        // it never emits ANSI, so it is level-independent and safe in workerd.
        expect(browserColorize.red("foo")).toStrictEqual(["%cfoo", "color: red;"]);
        expect(browserRed("foo")).toStrictEqual(["%cfoo", "color: red;"]);
        expect(browserBold.red("foo")).toStrictEqual(["%cfoo", "color:red;font-weight:bold;"]);
    });

    it("should strip ANSI from forwarded server output", () => {
        expect.assertions(1);

        expect(browserColorize.strip("\u001B[31mfoo\u001B[39m")).toBe("foo");
    });
});
