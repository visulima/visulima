import { afterEach, describe, expect, it } from "vitest";

import type { FormatterFunction } from "../src";
import { build, format } from "../src";

describe("fmt", () => {
    it.each([
        ["%s", ["foo"], "foo"],
        ["%s", [1], "1"],
        ["%s", [true], "true"],
        ["%s", [null], "null"],
        ["%s", [undefined], "undefined"],
        ["%s", [9_007_199_254_740_991n], "9007199254740991"],
        ["%s", [0b1_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111n], "9007199254740991"],
        ["%s", ["\"quoted\""], "\"quoted\""],
        ["%s", [{}], "{}"],
        ["%s", [{ foo: "bar" }], "{\"foo\":\"bar\"}"],
        ["%s", [{ baz: "qux", foo: "bar" }], "{\"baz\":\"qux\",\"foo\":\"bar\"}"],
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
        ["%%%s%%", ["hi"], "%hi%"],
        ["%%%s%%%%", ["hi"], "%hi%%"],
    ])("should format %s", (f, a, expected) => {
        expect.assertions(1);

        expect(format(f, a)).toBe(expected);
    });

    it.each([
        ["%cfoo", ["color: red"], "\u001B[31mfoo\u001B[0m"],
        ["%cfoo", ["color: red; background-color: blue"], "\u001B[44m\u001B[31mfoo\u001B[0m"],
        ["%cfoo%c bar", ["color: red", ""], "\u001B[31mfoo\u001B[39m bar\u001B[0m"],
        ["%cfoo %cbar", ["color:red", "color: blue"], "\u001B[31mfoo \u001B[34mbar\u001B[0m"],
    ])("should format %s", (f, a, expected) => {
        expect.assertions(1);

        expect(format(f, a)).toBe(expected);
    });

    it("should emit a color change for a second %c whose color shares a 3-char prefix with the first", () => {
        expect.assertions(1);

        expect(format("%cfoo %cbar", ["color:#ff0000", "color: #ff8800"])).toBe(
            "\u001B[38;2;255;0;0mfoo \u001B[38;2;255;136;0mbar\u001B[0m",
        );
    });

    it.each([
        ["%d", [42], "42"],
        ["%d", [42], "42"],
        ["%d", [undefined], "%d"],
        ["%d", [null], "%d"],
        ["%d", ["42.0"], "42"],
        ["%d", ["42"], "42"],
        ["%d %d", ["42"], "42 %d"],
        ["foo %d", ["42"], "foo 42"],
        ["%d%d", [11, 22], "1122"],
        ["%d%s", [11, 22], "1122"],
        ["%d%o", [11, { aa: 22 }], "11{\"aa\":22}"],
        ["%d%d%d", [11, 22, 33], "112233"],
        ["%d%d%s", [11, 22, 33], "112233"],
        ["%d%o%d%s", [11, { aa: 22 }, 33, "sss"], "11{\"aa\":22}33sss"],
        ["%d%%%d", [11, 22], "11%22"],
        ["%d%%%s", [11, 22], "11%22"],
    ])("should format %s", (f, a, expected) => {
        expect.assertions(1);

        expect(format(f, a)).toBe(expected);
    });

    it.each([["%f", [42.99], "42.99"]])("should format %s", (f, a, expected) => {
        expect.assertions(1);

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
        expect.assertions(1);

        expect(format(f, a)).toBe(expected);
    });

    it.each([
        ["%j", [42], "42"],
        ["%j", [undefined], "%j"],
        ["%j", [null], "null"],
        ["%j", ["42"], "'42'"],
        ["%j", [{ s: "\"quoted\"" }], String.raw`{"s":"\"quoted\""}`],
        ["foo %j", [{ foo: "foo" }], "foo {\"foo\":\"foo\"}"],
        ["foo %j %j", [{ foo: "foo" }], "foo {\"foo\":\"foo\"} %j"],
        ["foo %j", ["foo"], "foo 'foo'"],
        ["foo %j", [function foo() {}], "foo [Function: foo]"], // util.format returns "foo undefined" here
        // eslint-disable-next-line func-names
        ["foo %j", [function () {}], "foo [Function: <anonymous>]"],
        ["foo %j", [{ foo: "foo" }, "not-printed"], "foo {\"foo\":\"foo\"}"],
    ])("should format %s", (f, a, expected) => {
        expect.assertions(1);

        expect(format(f, a)).toBe(expected);
    });

    it("should format %j with stringify", () => {
        expect.assertions(1);

        expect(
            format("foo %j", [{ foo: "foo" }], {
                stringify() {
                    return "REPLACED";
                },
            }),
        ).toBe("foo REPLACED");
    });

    it("should format %O", () => {
        expect.assertions(2);

        expect(format("foo %o", [{ foo: "foo" }])).toBe("foo {\"foo\":\"foo\"}");
        expect(format("foo %O", [{ foo: "foo" }])).toBe("foo {\"foo\":\"foo\"}");
    });

    it("should format empty args", () => {
        expect.assertions(2);

        expect(format("", [])).toBe("");
        expect(format("%s", [])).toBe("%s");
    });

    it("should format empty string", () => {
        expect.assertions(1);

        expect(format("", ["a"])).toBe("");
    });

    it("should format object", () => {
        expect.assertions(2);

        const emptyObject = {};

        expect(format(emptyObject, [])).toBe("{}");
        expect(format(emptyObject, ["a", "b", "c"])).toBe("{} \"a\" \"b\" \"c\"");
    });

    it("should format ES6 Symbol", () => {
        expect.assertions(4);

        const symbol = Symbol("foo");

        expect(format("foo", [symbol])).toBe("foo");
        expect(format("%s", [symbol])).toBe("Symbol(foo)");
        expect(format("%j", [symbol])).toBe("undefined");
        expect(format("%d", [symbol])).toBe("NaN");
    });

    it("should handle circular references", () => {
        expect.assertions(2);

        const circularObject = {};

        // @ts-expect-error - circular reference
        circularObject.foo = circularObject;

        expect(format("%j", [circularObject])).toBe("\"[Circular]\"");
        expect(format("foo %j", [circularObject])).toBe("foo \"[Circular]\"");
    });

    it("should handle multiple", () => {
        expect.assertions(27);

        expect(format("%%", ["foo"])).toBe("%");
        expect(format("foo %%", ["foo"])).toBe("foo %");
        expect(format("foo %% %s", ["bar"])).toBe("foo % bar");

        expect(format("%s - %d", ["foo", undefined])).toBe("foo - %d");
        expect(format("%s - %f", ["foo", undefined])).toBe("foo - %f");
        expect(format("%s - %i", ["foo", undefined])).toBe("foo - %i");
        expect(format("%s - %O", ["foo", undefined])).toBe("foo - %O");
        expect(format("%s - %o", ["foo", undefined])).toBe("foo - %o");
        expect(format("%s - %j", ["foo", undefined])).toBe("foo - %j");
        expect(format("%s - %s", ["foo", undefined])).toBe("foo - undefined");
        expect(format("%s - %%", ["foo", undefined])).toBe("foo - %");

        expect(format("%s - %d", ["foo", null])).toBe("foo - %d");
        expect(format("%s - %f", ["foo", null])).toBe("foo - %f");
        expect(format("%s - %i", ["foo", null])).toBe("foo - %i");
        expect(format("%s - %O", ["foo", null])).toBe("foo - null");
        expect(format("%s - %o", ["foo", null])).toBe("foo - null");
        expect(format("%s - %j", ["foo", null])).toBe("foo - null");
        expect(format("%s - %s", ["foo", null])).toBe("foo - null");
        expect(format("%s - %%", ["foo", null])).toBe("foo - %");

        expect(format("%d%d", [11, 22])).toBe("1122");
        expect(format("%d%s", [11, 22])).toBe("1122");
        expect(format("%d%o", [11, { aa: 22 }])).toBe("11{\"aa\":22}");
        expect(format("%d%d%d", [11, 22, 33])).toBe("112233");
        expect(format("%d%d%s", [11, 22, 33])).toBe("112233");
        expect(format("%d%o%d%s", [11, { aa: 22 }, 33, "sss"])).toBe("11{\"aa\":22}33sss");
        expect(format("%d%%%d", [11, 22])).toBe("11%22");
        expect(format("%d%%%s", [11, 22])).toBe("11%22");
    });

    it("should throw a error if the fmt is not object or string", () => {
        expect.assertions(2);

        // @ts-expect-error - invalid fmt

        expect(() => format(1)).toThrow("fmt must be a string or object, got number");

        expect(() => format(null)).toThrow("fmt must be a string or object, got null");
    });

    it("should be possible to build a custom formatter", () => {
        expect.assertions(3);

        expect(() => build({ formatters: { haha: () => "Jonathan" } })).toThrow("Formatter %haha has more than one character");
        // @ts-expect-error - invalid formatter

        expect(() => build({ formatters: { t: "Jonathan" } })).toThrow("Formatter for %t is not a function");

        const customFormatter = build({
            formatters: { t: (ms: string) => new Date(ms).toISOString() },
        });
        const now = Date.now();

        expect(customFormatter("%s%t%s", ["[", now, "]"])).toBe(`[${new Date(now).toISOString()}]`);
    });

    it("should keep preceding text when %i is not at the start", () => {
        expect.assertions(1);

        expect(format("foo %i", [42])).toBe("foo 42");
    });

    it("should apply formatters passed directly to format()", () => {
        expect.assertions(2);

        // `format`'s own default case indexes `options.formatters` by codepoint, so the
        // map must be keyed by the specifier's codepoint (this is what `build` produces).
        const tCode = "t".codePointAt(0) as number;
        const formatters: Record<string, FormatterFunction> = { [tCode]: (value) => `<${String(value)}>` };

        expect(format("x %t y", ["VAL"], { formatters })).toBe("x <VAL> y");
        // formatter at the very start exercises the lastPosition seeding path.
        expect(format("%t end", ["VAL"], { formatters })).toBe("<VAL> end");
    });

    it("should leave the specifier untouched when its formatter is not a function", () => {
        expect.assertions(1);

        const tCode = "t".codePointAt(0) as number;
        const formatters: Record<string, FormatterFunction> = { [tCode]: undefined as unknown as FormatterFunction };

        expect(format("x %t y", ["VAL"], { formatters })).toBe("x %t y");
    });

    it("should build a formatter when no formatters option is supplied", () => {
        expect.assertions(1);

        const formatter = build({});

        expect(formatter("%s", ["hi"])).toBe("hi");
    });

    it("should honour a build-time stringify option", () => {
        expect.assertions(1);

        const formatter = build({ stringify: () => "REPLACED" });

        expect(formatter("%j", [{ foo: "foo" }])).toBe("REPLACED");
    });

    it("should honour a build-time appendExtraArguments option", () => {
        expect.assertions(1);

        const formatter = build({ appendExtraArguments: true });

        expect(formatter("hi", [1, 2, 3])).toBe("hi 1 2 3");
    });

    it("should let per-call formatOptions override a build-time option", () => {
        expect.assertions(2);

        const formatter = build({ stringify: () => "BASE" });

        expect(formatter("%j", [{ foo: "foo" }])).toBe("BASE");
        expect(formatter("%j", [{ foo: "foo" }], { stringify: () => "OVERRIDE" })).toBe("OVERRIDE");
    });

    it("should throw when a built formatter key is an empty string", () => {
        expect.assertions(1);

        expect(() => build({ formatters: { "": () => "x" } })).toThrow("Formatter % has no characters");
    });

    describe("in a browser-like environment", () => {
        afterEach(() => {
            delete (globalThis as { window?: unknown }).window;
        });

        it("should skip %c ANSI styling when globalThis.window is defined", () => {
            expect.assertions(1);

            (globalThis as { window?: unknown }).window = {};

            expect(format("%cfoo bar", ["color: red"])).toBe("foo bar");
        });
    });

    it("should not emit a trailing reset when %c styling produces no output", () => {
        expect.assertions(1);

        // `%c` with an empty CSS string yields an empty ANSI sequence and, since it sits at the
        // start of the string, leaves `result` empty so `usedStyle` is never flipped on.
        expect(format("%cfoo", [""])).toBe("foo");
    });

    describe("unknown specifiers", () => {
        it("should pass an unknown specifier through verbatim without consuming an argument", () => {
            expect.assertions(2);

            // `%x` has no formatter, so it must stay literal AND not eat the "hello" arg.
            expect(format("%x %s", ["hello"])).toBe("%x hello");
            expect(format("%s %x %s", ["a", "b"])).toBe("a %x b");
        });

        it("should keep later specifiers aligned after an unknown specifier", () => {
            expect.assertions(1);

            expect(format("%x%d", [42])).toBe("%x42");
        });
    });

    describe("appendExtraArguments option", () => {
        it("should append unconsumed arguments space-separated", () => {
            expect.assertions(3);

            expect(format("%s done", ["task", "extra"], { appendExtraArguments: true })).toBe("task done extra");
            expect(format("hi", [1, 2, 3], { appendExtraArguments: true })).toBe("hi 1 2 3");
            expect(format("%s", ["only"], { appendExtraArguments: true })).toBe("only");
        });

        it("should stringify object extras", () => {
            expect.assertions(1);

            expect(format("hi", [{ code: 1 }], { appendExtraArguments: true })).toBe("hi {\"code\":1}");
        });

        it("should use the provided stringify for object extras", () => {
            expect.assertions(1);

            expect(
                format("hi", [{ code: 1 }], {
                    appendExtraArguments: true,
                    stringify: () => "REPLACED",
                }),
            ).toBe("hi REPLACED");
        });

        it("should append extras even when the format string has no specifiers", () => {
            expect.assertions(1);

            // No specifier means `lastPosition` stays -1; extras must still be appended.
            expect(format("plain", ["a", "b"], { appendExtraArguments: true })).toBe("plain a b");
        });

        it("should drop extras when the option is not set (default)", () => {
            expect.assertions(1);

            expect(format("%s", ["a", "b", "c"])).toBe("a");
        });
    });

    describe("colors option", () => {
        afterEach(() => {
            delete (globalThis as { window?: unknown }).window;
        });

        it("should force %c off when colors is false", () => {
            expect.assertions(1);

            expect(format("%cfoo bar", ["color: red"], { colors: false })).toBe("foo bar");
        });

        it("should keep literal text before a mid-string %c when colors is false", () => {
            expect.assertions(1);

            expect(format("hello %cworld", ["color: red"], { colors: false })).toBe("hello world");
        });

        it("should keep literal text before a mid-string %c in a browser-like environment", () => {
            expect.assertions(1);

            (globalThis as { window?: unknown }).window = {};

            expect(format("hello %cworld", ["color: red"])).toBe("hello world");
        });

        it("should force %c on when colors is true even in a browser-like environment", () => {
            expect.assertions(1);

            (globalThis as { window?: unknown }).window = {};

            expect(format("%cfoo", ["color: red"], { colors: true })).toBe("\u001B[31mfoo\u001B[0m");
        });
    });
});
