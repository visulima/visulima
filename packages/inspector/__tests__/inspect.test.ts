import { describe, expect, it } from "vitest";

import { inspect } from "../src";
import type { Options } from "../src/types";

describe("inspect with Arrays", () => {
    it("should truncate an array of strings, not just the strings themselves", () => {
        expect.assertions(1);

        expect(inspect(["foo", "bar", "baz", "bing"], { maxStringLength: 22 })).toBe("[ 'foo', 'bar', …(2) ]");
    });

    it("should truncate strings within an array to stay under the maxStringLength threshold", () => {
        expect.assertions(1);

        expect(inspect(["foobarbazbing"], { maxStringLength: 15 })).toBe("[ 'foobarba…' ]");
    });

    it("should correctly inspect an array containing an anonymous function", () => {
        expect.assertions(1);

        expect(inspect([() => 1])).toBe("[ [Function: () => 1] ]");
    });
});

describe("inspect with Objects", () => {
    it("should correctly inspect an object with a Symbol as a key", () => {
        expect.assertions(1);

        expect(inspect({ [Symbol("foo")]: 1 })).toBe("{ [Symbol(foo)]: 1 }");
    });

    it("should correctly inspect an object with both regular properties and Symbol keys", () => {
        expect.assertions(1);

        expect(inspect({ foo: 1, [Symbol("foo")]: 1 })).toBe("{ foo: 1, [Symbol(foo)]: 1 }");
    });

    it("should not use a custom inspect function when the 'customInspect' option is false", () => {
        expect.assertions(1);

        const object = {
            inspect: () => 1,
        };

        expect(inspect(object, { customInspect: false })).toBe("{ inspect: [Function: () => 1] }");
    });

    it("should use a custom inspect function that returns a number when 'customInspect' is true", () => {
        expect.assertions(1);

        const object = {
            inspect: () => 1,
        };

        expect(inspect(object, { customInspect: true })).toBe("1");
    });

    it("should use a custom inspect function that returns a string when 'customInspect' is true", () => {
        expect.assertions(1);

        const object = {
            inspect: () => "abc",
        };

        expect(inspect(object, { customInspect: true })).toBe("abc");
    });

    it("should apply options to the result of a custom inspect function", () => {
        expect.assertions(1);

        const object = {
            inspect: () => ["foobarbazbing"],
        };

        expect(inspect(object, { customInspect: true, maxStringLength: 15 })).toBe("[ 'foobarba…' ]");
    });

    it("should use a custom inspect function on a nested object when 'customInspect' is true", () => {
        expect.assertions(1);

        const object = {
            sub: {
                inspect: (_depth: never, options: Options) => options.stylize("Object content", "string"),
            },
        };

        expect(inspect(object, { customInspect: true })).toBe("{ sub: Object content }");
    });

    it("should correctly inspect the object returned by a custom inspect function", () => {
        expect.assertions(1);

        const object = {
            sub: {
                inspect: () => {
                    return { foo: "bar" };
                },
            },
        };

        expect(inspect(object, { customInspect: true })).toBe("{ sub: { foo: 'bar' } }");
    });

    it.skipIf(globalThis.window !== undefined)(
        "should prioritize 'util.inspect.custom' symbol over 'inspect' method for custom inspection on node",
        async () => {
            expect.assertions(4);

            const utilityInspect = await import("node:util").then((m) => m.inspect);

            const object = {
                inspect: function stringInspect() {
                    return "string";
                },
            };

            object[utilityInspect.custom] = function custom() {
                return "symbol";
            };

            const symbolResult = "[ symbol, [] ]";
            const stringResult = "[ string, [] ]";
            const falseResult
                = "[ { inspect: [Function: function stringInspect() {\n        return \"string\";\n      }], [Symbol(nodejs.util.inspect.custom)]: [Function: function custom() {\n      return \"symbol\";\n    }] }, [] ]";

            const symbolStringFallback = utilityInspect.custom ? symbolResult : stringResult;

            expect(inspect([object, []])).toBe(symbolStringFallback);
            expect(inspect([object, []], { customInspect: true })).toBe(symbolStringFallback);
            expect(inspect([object, []], { customInspect: false })).toBe(falseResult);

            const object2 = {
                inspect: function stringInspect() {
                    return "string";
                },
            };

            object2[Symbol.for("nodejs.util.inspect.custom")] = function custom() {
                return "symbol";
            };

            expect(inspect([object2, []], { customInspect: false })).toBe(falseResult);
        },
    );

    it("should respect the 'depth' option when inspecting nested objects", () => {
        expect.assertions(3);

        const nestedObject = { n: { a: { b: { c: { d: { e: "3" } } } } } };

        expect(inspect(nestedObject, { depth: 1 })).toBe("{ n: [Object] }");
        expect(inspect(nestedObject, { depth: 2 })).toBe("{ n: { a: [Object] } }");
        expect(inspect(nestedObject, { depth: 3 })).toBe("{ n: { a: { b: [Object] } } }");
    });
});
