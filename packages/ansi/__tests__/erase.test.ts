import { describe, expect, it } from "vitest";

import erase from "../src/erase";

describe(`scroll`, () => {
    it("should return the correct ansi for up", () => {
        expect.assertions(3);

        expect(erase.up()).toBe(`\u001B[1J`);
        expect(erase.up(2)).toBe(`\u001B[1J\u001B[1J`);
        expect(erase.up(0)).toBe(``);
    });

    it("should return the correct ansi for down", () => {
        expect.assertions(3);

        expect(erase.down()).toBe(`\u001B[J`);
        expect(erase.down(2)).toBe(`\u001B[J\u001B[J`);
        expect(erase.down(0)).toBe(``);
    });

    it("should return the correct ansi for lines", () => {
        expect.assertions(2);

        expect(erase.lines(2)).toBe(`\u001B[2K\u001B[1A\u001B[2K\u001B[G`);
        expect(erase.lines(0)).toBe(``);
    });
});
