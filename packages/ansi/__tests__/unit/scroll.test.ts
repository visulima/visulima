import { describe, expect, it } from "vitest";

import scroll from "../../src/scroll";

describe(`scroll`, () => {
    it("should return the correct ansi for up", () => {
        expect.assertions(3);

        expect(scroll.up()).toBe(`\u001B[S`);
        expect(scroll.up(2)).toBe(`\u001B[S\u001B[S`);
        expect(scroll.up(0)).toBe(``);
    });

        it("should return the correct ansi for down", () => {
        expect.assertions(3);

        expect(scroll.down()).toBe(`\u001B[T`);
        expect(scroll.down(2)).toBe(`\u001B[T\u001B[T`);
        expect(scroll.down(0)).toBe(``);
    });
});
