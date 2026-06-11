// Test fixtures embed raw control bytes (ESC, BEL) and the ST terminator
// (ESC backslash), so String.raw cannot express them.
/* eslint-disable unicorn/prefer-string-raw */
import { describe, expect, it } from "vitest";

import strip from "../../src/strip";

describe(`ansi`, () => {
    /*
     * Modified copy of https://github.com/chalk/strip-ansi/blob/main/test.js
     *
     * MIT License
     * Copyright (c) Sindre Sorhus (https://sindresorhus.com)
     */
    describe(strip, () => {
        it("should strip color from string", () => {
            expect.assertions(1);

            expect(strip("[0m[4m[42m[31mfoo[39m[49m[24mfoo[0m")).toBe("foofoo");
        });

        it("should strip color from ls command", () => {
            expect.assertions(1);

            expect(strip("[00;38;5;244m[m[00;38;5;33mfoo[0m")).toBe("foo");
        });

        it("should strip reset;setfg;setbg;italics;strike;underline sequence from string", () => {
            expect.assertions(1);

            expect(strip("[0;33;49;3;9;4mbar[0m")).toBe("bar");
        });

        it("should strip link from terminal link", () => {
            expect.assertions(1);

            expect(strip("]8;;https://github.comclick]8;;")).toBe("click");
        });

        // According to https://en.wikipedia.org/wiki/ANSI_escape_code#OSC_(Operating_System_Command)_sequences, '\x1B]0;<TEXT>\x07' sequence should be stripped.
        it("should strip 'ESC ]0;<TEXT> BEL'", () => {
            expect.assertions(1);

            expect(strip("[2J[m[HABC\r\n]0;C:\\WINDOWS\\system32\\cmd.exe[?25h")).toBe("ABC\r\n");
        });

        it("should return non-ANSI input untouched (fast path)", () => {
            expect.assertions(2);

            expect(strip("plain text")).toBe("plain text");
            expect(strip("")).toBe("");
        });

        it("should strip an OSC title terminated by ST (ESC \\)", () => {
            expect.assertions(1);

            expect(strip("]0;My Title\\after")).toBe("after");
        });

        it("should strip a DCS string sequence terminated by ST", () => {
            expect.assertions(1);

            expect(strip("Psome dcs payload\\done")).toBe("done");
        });

        it("should strip two-character escapes (ESC 7 / ESC c)", () => {
            expect.assertions(1);

            expect(strip("7keepc")).toBe("keep");
        });

        it("should not strip a literal ']0;' that is not preceded by ESC", () => {
            expect.assertions(1);

            // Regression: a previous implementation matched a literal "]0;" anywhere.
            expect(strip("array]0;value")).toBe("array]0;value");
        });

        it("should be linear on adversarial unterminated OSC prefixes (no ReDoS)", () => {
            expect.assertions(1);

            const malicious = "]".repeat(200_000);
            const start = performance.now();

            strip(malicious);

            const elapsed = performance.now() - start;

            // A backtracking lazy scan would blow well past this; the linear
            // scanner finishes in single-digit milliseconds.
            expect(elapsed).toBeLessThan(1000);
        });
    });
});
