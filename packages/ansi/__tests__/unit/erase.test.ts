import { describe, expect, it } from "vitest";

import { eraseDown, eraseLine, eraseLineEnd, eraseLines, eraseLineStart, eraseScreen, eraseUp } from "../../src/erase";

describe(`scroll`, () => {
    it("should return the correct ansi for up", () => {
        expect.assertions(3);

        expect(eraseUp()).toBe(`\u001B[1J`);
        expect(eraseUp(2)).toBe(`\u001B[1J\u001B[1J`);
        expect(eraseUp(0)).toBe(``);
    });

    it("should return the correct ansi for down", () => {
        expect.assertions(3);

        expect(eraseDown()).toBe(`\u001B[J`);
        expect(eraseDown(2)).toBe(`\u001B[J\u001B[J`);
        expect(eraseDown(0)).toBe(``);
    });

    it("should return the correct ansi for lines", () => {
        expect.assertions(2);

        expect(eraseLines(2)).toBe(`\u001B[2K\u001B[1A\u001B[2K\u001B[G`);
        expect(eraseLines(0)).toBe(``);
    });

    it("should return the correct ansi for line", () => {
        expect.assertions(3);

        expect(eraseLine).toBe(`\u001B[2K`);
        expect(eraseLineStart).toBe(`\u001B[1K`);
        expect(eraseLineEnd).toBe(`\u001B[K`);
    });

    it("should return the correct ansi for screen", () => {
        expect.assertions(1);

        expect(eraseScreen).toBe(`\u001B[2J`);
    });
});
