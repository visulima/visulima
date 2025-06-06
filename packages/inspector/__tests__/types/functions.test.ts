import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Functions", () => {
    it("should include the function's name in the output", () => {
        expect.assertions(1);
        /* eslint-disable-next-line prefer-arrow-callback */
        expect(inspect(function foo() {})).toBe("[Function: function foo() {\n    }]");
    });

    it("should identify an anonymous function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,func-names */
        expect(inspect(function () {})).toBe("[Function: function() {\n    }]");
    });

    it("should correctly format arrow functions, including their body", () => {
        expect.assertions(2);

        expect(inspect(() => 3)).toBe("[Function: () => 3]");

        expect(inspect((a: string, b: string, c: string) => a + b + c)).toBe("[Function: (a, b, c) => a + b + c]");
    });

    describe("with maxStringLength option", () => {
        it("should return the full function name when maxStringLength is sufficient", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 17 })).toBe("[Function foobar]");
        });

        it("should truncate the function name when maxStringLength is 16", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 16 })).toBe("[Function foob…]");
        });

        it("should truncate the function name when maxStringLength is 15", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 15 })).toBe("[Function foo…]");
        });

        it("should truncate the function name when maxStringLength is 14", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 14 })).toBe("[Function fo…]");
        });

        it("should truncate the function name when maxStringLength is 13", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 13 })).toBe("[Function f…]");
        });

        it("should show only a truncation symbol for the name when maxStringLength is 12", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 12 })).toBe("[Function …]");
        });

        it("should show only a truncation symbol for the name when maxStringLength is 11", () => {
            expect.assertions(1);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 11 })).toBe("[Function …]");
        });

        it("should not truncate the '[Function …]' decoration, even with a small maxStringLength", () => {
            expect.assertions(5);

            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 4 })).toBe("[Function …]");
            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 3 })).toBe("[Function …]");
            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 2 })).toBe("[Function …]");
            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 1 })).toBe("[Function …]");
            /* eslint-disable-next-line prefer-arrow-callback */
            expect(inspect(function foobar() {}, { maxStringLength: 0 })).toBe("[Function …]");
        });
    });
});

describe("inspect with Async functions", () => {
    it("should include 'AsyncFunction' in the output for a named async function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback */
        expect(inspect(async function foo() {})).toBe("[AsyncFunction: async function foo() {\n    }]");
    });

    it("should identify an anonymous async function", () => {
        expect.assertions(1);

        /* eslint-disable-next-line prefer-arrow-callback,func-names */
        expect(inspect(async function () {})).toBe("[AsyncFunction: async function() {\n    }]");
    });
});

describe("inspect with Generator functions", () => {
    it("should include 'GeneratorFunction' in the output for a named generator function", () => {
        expect.assertions(1);

        expect(inspect(function* foo() {})).toBe("[GeneratorFunction: function* foo() {\n    }]");
    });

    it("should identify an anonymous generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names
        expect(inspect(function* () {})).toBe("[GeneratorFunction: function* () {\n    }]");
    });
});

describe("inspect with AsyncGenerator functions", () => {
    it("should include 'AsyncGeneratorFunction' in the output for a named async generator function", () => {
        expect.assertions(1);

        expect(inspect(async function* foo() {})).toBe("[AsyncGeneratorFunction: async function* foo() {\n    }]");
    });

    it("should identify an anonymous async generator function", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-names
        expect(inspect(async function* () {})).toBe("[AsyncGeneratorFunction: async function* () {\n    }]");
    });
});
