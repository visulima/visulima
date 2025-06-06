import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("regexps", () => {
    it("returns regexp wrapped in forward slashes", () => {
        expect.assertions(1);

        expect(inspect(/abc/)).toBe("/abc/");
    });

    it("detects flags and adds them after the slashes", () => {
        expect.assertions(1);

        // eslint-disable-next-line regexp/no-useless-flag
        expect(inspect(/abc/gim)).toBe("/abc/gim");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 14 })).toBe("/foobarbaz/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (13)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 13 })).toBe("/foobarb…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (12)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 12 })).toBe("/foobar…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (11)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 11 })).toBe("/fooba…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (10)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 10 })).toBe("/foob…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (9)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 9 })).toBe("/foo…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (8)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 8 })).toBe("/fo…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (7)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 7 })).toBe("/f…/gim");
        });

        it("maxStringLengths strings longer than maxStringLength (6)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 6 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (5)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 5 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (4)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 4 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (3)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 3 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (2)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 2 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (1)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 1 })).toBe("/…/gim");
        });

        it("disregards maxStringLength when it cannot maxStringLength further (0)", () => {
            expect.assertions(1);

            // eslint-disable-next-line regexp/no-useless-flag
            expect(inspect(/foobarbaz/gim, { maxStringLength: 0 })).toBe("/…/gim");
        });
    });
});
