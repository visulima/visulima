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
        /* eslint-disable-next-line prefer-arrow-callback,func-names */
        expect(inspect(function(a: string, b: string, c: string) { return a + b + c })).toBe("[Function: function(a, b, c) {\n      return a + b + c;\n    }]");
    });

    describe("colors", () => {
        it("returns string with cyan color, if colour is set to true", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foo() {}, { colors: true })).toBe("\u001B[36m[Function: function foo() {\n      }]\u001B[39m");
        });
    });

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 17 })).toBe("[Function foobar]");
        });

        it("truncates function names longer than truncate (16)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 16 })).toBe("[Function foob…]");
        });

        it("truncates function names longer than truncate (15)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 15 })).toBe("[Function foo…]");
        });
        it("truncates function names longer than truncate (14)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 14 })).toBe("[Function fo…]");
        });

        it("truncates function names longer than truncate (13)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 13 })).toBe("[Function f…]");
        });

        it("truncates function names longer than truncate (12)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 12 })).toBe("[Function …]");
        });

        it("truncates function names longer than truncate (11)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 11 })).toBe("[Function …]");
        });

        it("does not truncate decoration even when truncate is short (4)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 4 })).toBe("[Function …]");
        });

        it("does not truncate decoration even when truncate is short (3)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 3 })).toBe("[Function …]");
        });

        it("does not truncate decoration even when truncate is short (2)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 2 })).toBe("[Function …]");
        });

        it("does not truncate decoration even when truncate is short (1)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 1 })).toBe("[Function …]");
        });

        it("does not truncate decoration even when truncate is short (0)", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { truncate: 0 })).toBe("[Function …]");
        });
    });
});

describe("async functions", () => {
    it("returns the functions name wrapped in `[AsyncFunction ]`", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,@typescript-eslint/no-empty-function */
        expect(inspect(async function foo() {})).toBe("[AsyncFunction foo]");
    });

    it("returns the `[AsyncFunction]` if given anonymous function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,@typescript-eslint/no-empty-function,func-names */
        expect(inspect(async function () {})).toBe("[AsyncFunction]");
    });
});

describe("generator functions", () => {
    it("returns the functions name wrapped in `[GeneratorFunction ]`", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        expect(inspect(function* foo() {})).toBe("[GeneratorFunction foo]");
    });

    it("returns the `[GeneratorFunction]` if given a generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-empty-function,func-names
        expect(inspect(function* () {})).toBe("[GeneratorFunction]");
    });
});

describe("async generator functions", () => {
    it("returns the functions name wrapped in `[AsyncGeneratorFunction ]`", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        expect(inspect(async function* foo() {})).toBe("[AsyncGeneratorFunction foo]");
    });

    it("returns the `[AsyncGeneratorFunction]` if given a async generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names,@typescript-eslint/no-empty-function
        expect(inspect(async function* () {})).toBe("[AsyncGeneratorFunction]");
    });
});
