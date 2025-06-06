import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("functions", () => {
    it("returns the functions name wrapped in `[Function ]`", () => {
        expect.assertions(1);
        /* eslint-disable-next-line prefer-arrow-callback */
        expect(inspect(function foo() {})).toBe("[Function: function foo() {\n    }]");
    });

    it("returns the `[Function]` if given anonymous function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,func-names */
        expect(inspect(function () {})).toBe("[Function: function() {\n    }]");
    });

    it("returns the `[Function]` with the given body", () => {
        expect.assertions(2);

        expect(inspect(() => 3)).toBe("[Function: () => 3]");

        expect(inspect((a: string, b: string, c: string) => a + b + c)).toBe("[Function: (a, b, c) => a + b + c]");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 17 })).toBe("[Function foobar]");
        });

        it("maxStringLengths function names longer than maxStringLength (16)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 16 })).toBe("[Function foob…]");
        });

        it("maxStringLengths function names longer than maxStringLength (15)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 15 })).toBe("[Function foo…]");
        });

        it("maxStringLengths function names longer than maxStringLength (14)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 14 })).toBe("[Function fo…]");
        });

        it("maxStringLengths function names longer than maxStringLength (13)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 13 })).toBe("[Function f…]");
        });

        it("maxStringLengths function names longer than maxStringLength (12)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 12 })).toBe("[Function …]");
        });

        it("maxStringLengths function names longer than maxStringLength (11)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 11 })).toBe("[Function …]");
        });

        it("does not maxStringLength decoration even when maxStringLength is short (4)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 4 })).toBe("[Function …]");
        });

        it("does not maxStringLength decoration even when maxStringLength is short (3)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 3 })).toBe("[Function …]");
        });

        it("does not maxStringLength decoration even when maxStringLength is short (2)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 2 })).toBe("[Function …]");
        });

        it("does not maxStringLength decoration even when maxStringLength is short (1)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 1 })).toBe("[Function …]");
        });

        it("does not maxStringLength decoration even when maxStringLength is short (0)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 0 })).toBe("[Function …]");
        });
    });
});

describe("async functions", () => {
    it("returns the functions name wrapped in `[AsyncFunction ]`", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback */
        expect(inspect(async function foo() {})).toBe("[AsyncFunction: async function foo() {\n    }]");
    });

    it("returns the `[AsyncFunction]` if given anonymous function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,func-names */
        expect(inspect(async function () {})).toBe("[AsyncFunction: async function() {\n    }]");
    });
});

describe("generator functions", () => {
    it("returns the functions name wrapped in `[GeneratorFunction ]`", () => {
        expect.assertions(1);

        expect(inspect(function* foo() {})).toBe("[GeneratorFunction: function* foo() {\n    }]");
    });

    it("returns the `[GeneratorFunction]` if given a generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names
        expect(inspect(function* () {})).toBe("[GeneratorFunction: function* () {\n    }]");
    });
});

describe("async generator functions", () => {
    it("returns the functions name wrapped in `[AsyncGeneratorFunction ]`", () => {
        expect.assertions(1);

        expect(inspect(async function* foo() {})).toBe("[AsyncGeneratorFunction: async function* foo() {\n    }]");
    });

    it("returns the `[AsyncGeneratorFunction]` if given a async generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names
        expect(inspect(async function* () {})).toBe("[AsyncGeneratorFunction: async function* () {\n    }]");
    });
});
