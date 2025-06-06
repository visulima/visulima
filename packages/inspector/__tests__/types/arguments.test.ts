import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

// eslint-disable-next-line func-style,@typescript-eslint/naming-convention,no-underscore-dangle
function arguments_() {
    // eslint-disable-next-line prefer-rest-params
    return arguments;
}

describe("inspect with arguments", () => {
    it("should return 'Arguments []' for an empty arguments object", () => {
        expect.assertions(1);

        expect(inspect(arguments_())).toBe("Arguments []");
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 20 })).toBe("Arguments [ 1, 2, 3 ]");
        });

        it("should truncate the representation when maxStringLength is 19", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 19 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 18", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 18 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 17", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 17 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 16", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 16 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 15", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 15 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 14", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 14 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 13", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 13 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 12", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 12 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 11", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 11 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 10", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 10 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 9", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 9 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 8", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 8 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 7", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 7 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 6", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 6 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 5", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 5 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 4", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 4 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 3", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 3 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 2", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 2 })).toBe("Arguments [ …(3) ]");
        });

        it("should truncate the representation when maxStringLength is 1", () => {
            expect.assertions(1);

            expect(inspect(arguments_(1, 2, 3), { maxStringLength: 1 })).toBe("Arguments [ …(3) ]");
        });
    });
});
