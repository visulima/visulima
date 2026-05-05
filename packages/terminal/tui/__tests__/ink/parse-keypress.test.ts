import { describe, expect, it } from "vitest";

import parseKeypress from "../../src/ink/parse-keypress";

describe("parse-keypress", () => {
    // VT220-style modifier sequences (ESC [ 1 ; <mod> P/Q/R/S)
    // Modifier encoding: ctrl = 5 (bit 4 + 1), shift = 2 (bit 1 + 1)

    it('ctrl+F1 resolves to name "f1"', () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[1;5P");

        expect(key.name).toBe("f1");
        expect(key.ctrl).toBe(true);
        expect(key.shift).toBe(false);
    });

    it('ctrl+F2 resolves to name "f2"', () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[1;5Q");

        expect(key.name).toBe("f2");
        expect(key.ctrl).toBe(true);
        expect(key.shift).toBe(false);
    });

    it('ctrl+F3 resolves to name "f3"', () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[1;5R");

        expect(key.name).toBe("f3");
        expect(key.ctrl).toBe(true);
        expect(key.shift).toBe(false);
    });

    it('ctrl+F4 resolves to name "f4"', () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[1;5S");

        expect(key.name).toBe("f4");
        expect(key.ctrl).toBe(true);
        expect(key.shift).toBe(false);
    });

    it("unmapped ctrl sequence returns empty name", () => {
        // ESC [ 1 ; 5 X — X is not a mapped function key letter
        expect.assertions(2);

        const key = parseKeypress("\u001B[1;5X");

        expect(key.name).toBe("");
        expect(key.ctrl).toBe(true);
    });

    it("another unmapped ctrl sequence returns empty name", () => {
        // ESC [ 1 ; 5 Y — Y is not a mapped function key letter
        expect.assertions(2);

        const key = parseKeypress("\u001B[1;5Y");

        expect(key.name).toBe("");
        expect(key.ctrl).toBe(true);
    });

    it('shift+F1 resolves to name "f1" with shift', () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[1;2P");

        expect(key.name).toBe("f1");
        expect(key.shift).toBe(true);
        expect(key.ctrl).toBe(false);
    });
});
