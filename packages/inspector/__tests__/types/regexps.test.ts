import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Regular Expressions", () => {
    it("should inspect a RegExp", () => {
        expect.assertions(1);

        expect(inspect(/abc/)).toBe("/abc/");
    });

    it("should inspect a RegExp with flags", () => {
        expect.assertions(1);

        // eslint-disable-next-line regexp/no-useless-flag
        expect(inspect(/abc/gim)).toBe("/abc/gim");
    });

    describe("maxStringLength option", () => {
        it("should truncate a long RegExp", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 13 })).toBe("/foobarb…/gim");
        });

        it("should not truncate a short RegExp", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 14 })).toBe("/foobarbaz/gim");
        });

        it("should truncate a long RegExp to a minimum length", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 5 })).toBe("/…/gim");
        });
    });
});
