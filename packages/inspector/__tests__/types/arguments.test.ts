import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

// eslint-disable-next-line func-style,@typescript-eslint/naming-convention,no-underscore-dangle
function arguments_() {
    // eslint-disable-next-line prefer-rest-params
    return arguments;
}

describe("arguments", () => {
    it("returns `Arguments []` for empty arguments", () => {
        expect.assertions(1);

        expect(inspect(arguments_())).toBe("Arguments []");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 20 })).toBe("Arguments [ 1, 2, 3 ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 19 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 18 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 17 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 16 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 15 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 14 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 13 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 12 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 11 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 10 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 9 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 8 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 7 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 6 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 5 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 4 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 3 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 2 })).toBe("Arguments [ …(3) ]");
        });

        it("maxStringLengths arguments values longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 1 })).toBe("Arguments [ …(3) ]");
        });
    });
});
