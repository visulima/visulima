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
