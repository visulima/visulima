import { describe, expect, it } from "vitest";

import {
    DEC_SPECIAL_GRAPHICS,
    G0,
    G1,
    LS0,
    LS1,
    LS1R,
    LS2,
    LS2R,
    LS3,
    LS3R,
    SCS,
    selectCharacterSet,
    SI,
    SO,
    USASCII,
} from "../../src/charset";
import { ESC } from "../../src/constants";

describe("character set selection (SCS)", () => {
    it("should designate USASCII into G0", () => {
        expect.assertions(1);
        expect(selectCharacterSet(G0, USASCII)).toBe(`${ESC}(B`);
    });

    it("should designate the DEC special graphics set into G1", () => {
        expect.assertions(1);
        expect(selectCharacterSet(G1, DEC_SPECIAL_GRAPHICS)).toBe(`${ESC})0`);
    });

    it("should expose SCS as an alias", () => {
        expect.assertions(1);
        expect(SCS).toBe(selectCharacterSet);
    });

    it("should expose the single-byte locking shifts SI and SO", () => {
        expect.assertions(4);
        expect(LS0).toBe("\u000F");
        expect(SI).toBe(LS0);
        expect(LS1).toBe("\u000E");
        expect(SO).toBe(LS1);
    });

    it("should expose the escape-based locking shifts", () => {
        expect.assertions(5);
        expect(LS1R).toBe(`${ESC}~`);
        expect(LS2).toBe(`${ESC}n`);
        expect(LS2R).toBe(`${ESC}}`);
        expect(LS3).toBe(`${ESC}o`);
        expect(LS3R).toBe(`${ESC}|`);
    });
});
