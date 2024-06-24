import { describe, expect, it } from "vitest";

import { scrollDown, scrollUp } from "../../src/scroll";

describe(`scroll`, () => {
    it("should return the correct ansi for up", () => {
        expect.assertions(3);

        expect(scrollUp()).toBe(`\u001B[S`);
        expect(scrollUp(2)).toBe(`\u001B[S\u001B[S`);
        expect(scrollUp(0)).toBe(``);
    });

    it("should return the correct ansi for down", () => {
        expect.assertions(3);

        expect(scrollDown()).toBe(`\u001B[T`);
        expect(scrollDown(2)).toBe(`\u001B[T\u001B[T`);
        expect(scrollDown(0)).toBe(``);
    });
});
