import { describe, expect, it } from "vitest";

import strip from "../../src/strip";

describe(`ansi`, () => {
    /**
     * Modified copy of https://github.com/chalk/strip-ansi/blob/main/test.js
     *
     * MIT License
     * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
     */
    describe(strip, () => {
        it("should strip color from string", () => {
            expect.assertions(1);

            expect(strip("\u001B[0m\u001B[4m\u001B[42m\u001B[31mfoo\u001B[39m\u001B[49m\u001B[24mfoo\u001B[0m")).toBe("foofoo");
        });

        it("should strip color from ls command", () => {
            expect.assertions(1);

            expect(strip("\u001B[00;38;5;244m\u001B[m\u001B[00;38;5;33mfoo\u001B[0m")).toBe("foo");
        });

        it("should strip reset;setfg;setbg;italics;strike;underline sequence from string", () => {
            expect.assertions(1);

            expect(strip("\u001B[0;33;49;3;9;4mbar\u001B[0m")).toBe("bar");
        });

        it("should strip link from terminal link", () => {
            expect.assertions(1);

            expect(strip("\u001B]8;;https://github.com\u0007click\u001B]8;;\u0007")).toBe("click");
        });

        // According to https://en.wikipedia.org/wiki/ANSI_escape_code#OSC_(Operating_System_Command)_sequences, '\x1B]0;<TEXT>\x07' sequence should be stripped.
        it("should strip 'ESC ]0;<TEXT> BEL'", () => {
            expect.assertions(1);

            expect(strip("\u001B[2J\u001B[m\u001B[HABC\r\n\u001B]0;C:\\WINDOWS\\system32\\cmd.exe\u0007\u001B[?25h")).toBe("ABC\r\n");
        });
    });
});
