import { describe, expect, it } from "vitest";

import { sanitizeTerminalText } from "../../src/util/sanitize-terminal";

describe(sanitizeTerminalText, () => {
    it("leaves ordinary printable text untouched", () => {
        expect.assertions(1);

        expect(sanitizeTerminalText("create-vite 5.2.0 — fix")).toBe("create-vite 5.2.0 — fix");
    });

    it("removes ANSI/VT escape sequences", () => {
        expect.assertions(1);

        // ESC[2K erase-line + ESC[1A cursor-up — the line-spoofing primitives.
        expect(sanitizeTerminalText("safe\u001B[2K\u001B[1Aspoof")).toBe("safespoof");
    });

    it("removes bare control characters (CR, BEL, backspace)", () => {
        expect.assertions(1);

        expect(sanitizeTerminalText("a\rbc\bd")).toBe("abcd");
    });

    it("normalises tabs to spaces", () => {
        expect.assertions(1);

        expect(sanitizeTerminalText("a\tb")).toBe("a b");
    });
});
