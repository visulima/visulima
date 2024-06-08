import { describe, expect, it } from "vitest";

import { inspect } from "../src";

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

        expect(inspect([() => 1])).toBe("[ [Function] ]");
    });
});

describe("objects", () => {
    it("correctly inspects Symbols as object keys", () => {
        expect.assertions(1);

        expect(inspect({ [Symbol("foo")]: 1 })).toBe("{ [Symbol(foo)]: 1 }");
    });

    it("correctly inspects properties and Symbols as object keys", () => {
        expect.assertions(1);

        expect(inspect({ [Symbol("foo")]: 1, foo: 1 })).toBe("{ foo: 1, [Symbol(foo)]: 1 }");
    });

    it("does not use custom inspect functions if `customInspect` is turned off", () => {
        expect.assertions(1);

        const object = {
            inspect: () => 1,
        };
        expect(inspect(object, { customInspect: false })).toBe("{ inspect: [Function inspect] }");
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
                inspect: (depth, options) => options.stylize("Object content", "string"),
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
});
