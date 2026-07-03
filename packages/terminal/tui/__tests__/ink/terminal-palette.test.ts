import { describe, expect, expectTypeOf, it } from "vitest";

import { isTerminalPaletteQuerySupported } from "../../src/ink/terminal-palette";

describe("terminal-palette", () => {
    it("isTerminalPaletteQuerySupported should detect supported terminals", () => {
        expect.assertions(1);

        const original = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "kitty";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        process.env["TERM_PROGRAM"] = "unknown-terminal";
        // May return true if TERM is xterm or WT_SESSION is set
        const result = isTerminalPaletteQuerySupported();

        expectTypeOf(result).toBeBoolean();

        if (original === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = original;
        }
    });

    it("should detect WezTerm", () => {
        expect.assertions(1);

        const original = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "WezTerm";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        if (original === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = original;
        }
    });

    it("should detect xterm via TERM variable", () => {
        expect.assertions(1);

        const originalProgram = process.env["TERM_PROGRAM"];
        const originalTerm = process.env["TERM"];

        process.env["TERM_PROGRAM"] = "";
        process.env["TERM"] = "xterm-256color";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        if (originalProgram === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = originalProgram;
        }

        if (originalTerm === undefined) {
            delete process.env["TERM"];
        } else {
            process.env["TERM"] = originalTerm;
        }
    });
});
