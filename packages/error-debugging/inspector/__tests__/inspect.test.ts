import { describe, expect, it } from "vitest";

import { custom as customSymbol, inspect } from "../src";
import type { Options } from "../src/types";

describe("arrays", () => {
    it("truncates an array of strings rather than just the strings", () => {
        expect.assertions(1);

        expect(inspect(["foo", "bar", "baz", "bing"], { truncate: 22 })).toBe("[ 'foo', 'bar', …(2) ]");
    });

    it("truncates the string in certain cases, to keep under the truncate threshold", () => {
        expect.assertions(1);

        expect(inspect(["foobarbazbing"], { truncate: 15 })).toBe("[ 'foobarba…' ]");
    });

    it("can contain anonymous functions", () => {
        expect.assertions(1);

        expect(inspect([() => 1])).toBe("[ [Function: () => 1] ]");
    });
});

describe("objects", () => {
    it("correctly inspects Symbols as object keys", () => {
        expect.assertions(1);

        expect(inspect({ [Symbol("foo")]: 1 })).toBe("{ [Symbol(foo)]: 1 }");
    });

    it("correctly inspects properties and Symbols as object keys", () => {
        expect.assertions(1);

        expect(inspect({ foo: 1, [Symbol("foo")]: 1 })).toBe("{ foo: 1, [Symbol(foo)]: 1 }");
    });

    it("does not use custom inspect functions if `customInspect` is turned off", () => {
        expect.assertions(1);

        const object = {
            inspect: () => 1,
        };

        expect(inspect(object, { customInspect: false })).toBe("{ inspect: [Function: () => 1] }");
    });

    it("uses custom inspect function is `customInspect` is turned on", () => {
        expect.assertions(1);

        const object = {
            inspect: () => 1,
        };

        expect(inspect(object, { customInspect: true })).toBe("1");
    });

    it("uses custom inspect function if `customInspect` is turned on", () => {
        expect.assertions(1);

        const object = {
            inspect: () => "abc",
        };

        expect(inspect(object, { customInspect: true })).toBe("abc");
    });

    it("uses the `chai/inspect` (custom) symbol when `customInspect` is turned on", () => {
        expect.assertions(2);

        const object = {
            [customSymbol]: () => "chai-custom",
        };

        expect(inspect(object, { customInspect: true })).toBe("chai-custom");
        expect(inspect(object, { customInspect: false })).not.toBe("chai-custom");
    });

    it("inspects custom inspect function result", () => {
        expect.assertions(1);

        const object = {
            inspect: () => ["foobarbazbing"],
        };

        expect(inspect(object, { customInspect: true, truncate: 15 })).toBe("[ 'foobarba…' ]");
    });

    it("uses a custom deeply nested inspect function if `customInspect` is turned on", () => {
        expect.assertions(1);

        const object = {
            sub: {
                inspect: (_depth: never, options: Options) => options.stylize("Object content", "string"),
            },
        };

        expect(inspect(object, { customInspect: true })).toBe("{ sub: Object content }");
    });

    it("inspect with custom object-returning inspect", () => {
        expect.assertions(1);

        const object = {
            sub: {
                inspect: () => {
                    expect.assertions(1);

                    return { foo: "bar" };
                },
            },
        };

        expect(inspect(object, { customInspect: true })).toBe("{ sub: { foo: 'bar' } }");
    });

    it.skipIf("window" in globalThis)("should inspect custom util.inspect symbols", async () => {
        expect.assertions(4);

        const utilityInspect = await import("node:util").then((m) => m.inspect);

        const object = {
            inspect: function stringInspect() {
                return "string";
            },
        };

        object[utilityInspect.custom as unknown as keyof typeof object] = function custom() {
            return "symbol";
        };

        const symbolResult = "[ symbol, [] ]";
        const stringResult = "[ string, [] ]";
        const stringInspectString = object.inspect.toString();

        const customString = (object as any)[Symbol.for("nodejs.util.inspect.custom")].toString();
        const falseResult = `[ { inspect: [Function: ${stringInspectString}], [Symbol(nodejs.util.inspect.custom)]: [Function: ${String(customString)}] }, [] ]`;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fallback for older Node without util.inspect.custom
        const symbolStringFallback = utilityInspect.custom ? symbolResult : stringResult;

        expect(inspect([object, []])).toBe(symbolStringFallback);
        expect(inspect([object, []], { customInspect: true })).toBe(symbolStringFallback);
        expect(inspect([object, []], { customInspect: false })).toBe(falseResult);

        const object2 = {
            inspect: function stringInspect() {
                return "string";
            },
        };

        (object2 as Record<symbol, unknown>)[Symbol.for("nodejs.util.inspect.custom")] = function custom() {
            return "symbol";
        };

        expect(inspect([object2, []], { customInspect: false })).toBe(falseResult);
    });

    it("should respect the depth options", () => {
        expect.assertions(3);

        const nestedObject = { n: { a: { b: { c: { d: { e: "3" } } } } } };

        expect(inspect(nestedObject, { depth: 1 })).toBe("{ n: [Object] }");
        expect(inspect(nestedObject, { depth: 2 })).toBe("{ n: { a: [Object] } }");
        expect(inspect(nestedObject, { depth: 3 })).toBe("{ n: { a: { b: [Object] } } }");
    });
});
