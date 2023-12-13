import { describe, expect, it } from "vitest";
import * as util from "node:util";

import { format, build } from "../src/index";

describe("fmt", () => {
    it.each([
        ["%s", ["foo"], "foo"],
        ["%s", [1], "1"],
        ["%s", [true], "true"],
        ["%s", [null], "null"],
        ["%s", [undefined], "undefined"],
        ["%s", [BigInt(9007199254740991)], "9007199254740991"],
        ["%s", [BigInt(0b11111111111111111111111111111111111111111111111111111)], "9007199254740991"],
        ["%s", ['"quoted"'], '"quoted"'],
        ["%s", [{}], "{}"],
        ["%s", [{ foo: "bar" }], '{"foo":"bar"}'],
        ["%s", [{ foo: "bar", baz: "qux" }], '{"foo":"bar","baz":"qux"}'],
        ["%s:%s", [], "%s:%s"],
        ["%s:%s", [undefined], "undefined:%s"],
        ["%s:%s", ["foo"], "foo:%s"],
        ["%s:%s", ["foo", "bar"], "foo:bar"],
        ["%s:%s", ["foo", "bar", "baz"], "foo:bar"],
        ["%s%s", [], "%s%s"],
        ["%s%s", [undefined], "undefined%s"],
        ["%s%s", ["foo"], "foo%s"],
        ["%s%s", ["foo", "bar"], "foobar"],
        ["%s%s", ["foo", "bar", "baz"], "foobar"],
        ["foo %s", ["foo"], "foo foo"],
        ["%%s%s", ["foo"], "%sfoo"],
    ])("should format %s", (f, a, expected) => {
        expect(format(f, a)).toBe(expected);
    });

    it.each([
        ["%d", [42.0], "42"],
        ["%d", [42], "42"],
        ["%d", [undefined], "%d"],
        ["%d", [null], "%d"],
        ["%d", ["42.0"], "42"],
        ["%d", ["42"], "42"],
        ["%d %d", ["42"], "42 %d"],
        ["foo %d", ["42"], "foo 42"],
        ["%d%d", [11, 22], "1122"],
        ["%d%s", [11, 22], "1122"],
        ["%d%o", [11, { aa: 22 }], '11{"aa":22}'],
        ["%d%d%d", [11, 22, 33], "112233"],
        ["%d%d%s", [11, 22, 33], "112233"],
        ["%d%o%d%s", [11, { aa: 22 }, 33, "sss"], '11{"aa":22}33sss'],
        ["%d%%%d", [11, 22], "11%22"],
        ["%d%%%s", [11, 22], "11%22"],
    ])("should format %s", (f, a, expected) => {
        expect(format(f, a)).toBe(expected);
    });

    it.each([["%f", [42.99], "42.99"]])("should format %s", (f, a, expected) => {
        expect(format(f, a)).toBe(expected);
    });

    it.each([
        ["%i", [42.99], "42"],
        ["%i", [null], "%i"],
        ["%i", ["42"], "42"],
        ["%i", ["42.99"], "42"],
        ["%i %i", ["42"], "42 %i"],
        ["%i %i", ["42.99"], "42 %i"],
    ])("should format %s", (f, a, expected) => {
        expect(format(f, a)).toBe(expected);
    });

    it.each([
        ["%j", [42], "42"],
        ["%j", [undefined], "%j"],
        ["%j", [null], "null"],
        // ['%j', ['42'], '"42"');
        ["%j", [{ s: '"quoted"' }], '{"s":"\\"quoted\\""}'],
        ["foo %j", [{ foo: "foo" }], 'foo {"foo":"foo"}'],
        ["foo %j %j", [{ foo: "foo" }], 'foo {"foo":"foo"} %j'],
        ["foo %j", ["foo"], "foo 'foo'"], // TODO: isn't this wrong?
        ["foo %j", [function foo() {}], "foo foo"],
        ["foo %j", [function () {}], "foo <anonymous>"],
        ["foo %j", [{ foo: "foo" }, "not-printed"], 'foo {"foo":"foo"}'],
    ])("should format %s", (f, a, expected) => {
        expect(format(f, a)).toBe(expected);
    });

    it("should format %j with stringify", () => {
        expect(
            format("foo %j", [{ foo: "foo" }], {
                stringify() {
                    return "REPLACED";
                },
            }),
        ).toBe("foo REPLACED");
    });

    it("should format %O", () => {
        expect(format("foo %o", [{ foo: "foo" }])).toEqual('foo {"foo":"foo"}');
        expect(format("foo %O", [{ foo: "foo" }])).toEqual('foo {"foo":"foo"}');
    });

    it("should format empty args", () => {
        expect(format("", [])).toEqual("");
        expect(format("%s", [])).toEqual("%s");
    });

    it("should format empty string", () => {
        expect(format("", ["a"])).toEqual("");
    });

    it("should format object", () => {
        const emptyObj = {};

        expect(format(emptyObj, [])).toEqual(emptyObj);
        expect(format(emptyObj, ["a", "b", "c"])).toEqual('{} "a" "b" "c"');
    });

    it("should format ES6 Symbol", () => {
        const symbol = Symbol("foo");
        expect(format(null, [symbol])).toEqual(null);
        expect(format("foo", [symbol])).toEqual("foo");
        expect(format("%s", [symbol])).toEqual("Symbol(foo)");
        expect(format("%j", [symbol])).toEqual("undefined");
        expect(function () {
            format("%d", [symbol]);
        }).toThrow(TypeError);
    });

    it("should handle circular references", () => {
        const circularObject = {};
        // @ts-expect-error - circular reference
        circularObject.foo = circularObject;

        expect(format("%j", [circularObject])).toEqual('"[Circular]"');
        expect(format("foo %j", [circularObject])).toEqual('foo "[Circular]"');
    });

    it("should handle multiple", () => {
        expect(format("%%", ["foo"])).toEqual("%");
        expect(format("foo %%", ["foo"])).toEqual("foo %");
        expect(format("foo %% %s", ["bar"])).toEqual("foo % bar");

        expect(format("%s - %d", ["foo", undefined])).toEqual("foo - %d");
        expect(format("%s - %f", ["foo", undefined])).toEqual("foo - %f");
        expect(format("%s - %i", ["foo", undefined])).toEqual("foo - %i");
        expect(format("%s - %O", ["foo", undefined])).toEqual("foo - %O");
        expect(format("%s - %o", ["foo", undefined])).toEqual("foo - %o");
        expect(format("%s - %j", ["foo", undefined])).toEqual("foo - %j");
        expect(format("%s - %s", ["foo", undefined])).toEqual("foo - undefined");
        expect(format("%s - %%", ["foo", undefined])).toEqual("foo - %");

        expect(format("%s - %d", ["foo", null])).toEqual("foo - %d");
        expect(format("%s - %f", ["foo", null])).toEqual("foo - %f");
        expect(format("%s - %i", ["foo", null])).toEqual("foo - %i");
        expect(format("%s - %O", ["foo", null])).toEqual("foo - null");
        expect(format("%s - %o", ["foo", null])).toEqual("foo - null");
        expect(format("%s - %j", ["foo", null])).toEqual("foo - null");
        expect(format("%s - %s", ["foo", null])).toEqual("foo - null");
        expect(format("%s - %%", ["foo", null])).toEqual("foo - %");

        expect(format("%d%d", [11, 22])).toEqual("1122");
        expect(format("%d%s", [11, 22])).toEqual("1122");
        expect(format("%d%o", [11, { aa: 22 }])).toEqual('11{"aa":22}');
        expect(format("%d%d%d", [11, 22, 33])).toEqual("112233");
        expect(format("%d%d%s", [11, 22, 33])).toEqual("112233");
        expect(format("%d%o%d%s", [11, { aa: 22 }, 33, "sss"])).toEqual('11{"aa":22}33sss');
        expect(format("%d%%%d", [11, 22])).toEqual("11%22");
        expect(format("%d%%%s", [11, 22])).toEqual("11%22");
    });

    it("should be possible to build a custom formatter", () => {
        expect(() => build({ formatters: { haha: () => "Jonathan" } })).toThrow();
        // @ts-expect-error - invalid formatter
        expect(() => build({ formatters: { t: "Jonathan" } })).toThrow();

        const customFormatter = build({
            formatters: { t: (ms) => new Date(ms).toISOString() },
        });
        const now = Date.now();

        expect(customFormatter("%s%t%s", ["[", now, "]"])).toEqual(`[${new Date(now).toISOString()}]`);
    });
});
