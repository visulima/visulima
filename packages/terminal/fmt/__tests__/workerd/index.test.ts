import { describe, expect, it } from "vitest";

import type { FormatterFunction } from "../../src";
import { build, format } from "../../src";

describe("fmt in workerd", () => {
    it("should run inside the workers runtime", () => {
        expect.assertions(2);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `navigator` is a workerd global, not a Node builtin
        expect((globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent).toBe("Cloudflare-Workers");
        // `%c` styling is gated on `globalThis.window` being undefined; workerd has no `window`,
        // so the formatter must behave like a server runtime rather than a browser.
        expect((globalThis as { window?: unknown }).window).toBeUndefined();
    });

    describe("%s", () => {
        it.each([
            ["%s", ["foo"], "foo"],
            ["%s", [1], "1"],
            ["%s", [true], "true"],
            ["%s", [null], "null"],
            ["%s", [undefined], "undefined"],
            ["%s", [9_007_199_254_740_991n], "9007199254740991"],
            ["%s", [{}], "{}"],
            ["%s", [{ foo: "bar" }], "{\"foo\":\"bar\"}"],
            ["%s:%s", [], "%s:%s"],
            ["%s:%s", ["foo"], "foo:%s"],
            ["%s:%s", ["foo", "bar"], "foo:bar"],
            ["foo %s", ["foo"], "foo foo"],
            ["%%s%s", ["foo"], "%sfoo"],
        ])("should format %s", (f, a, expected) => {
            expect.assertions(1);

            expect(format(f, a)).toBe(expected);
        });
    });

    describe("%d, %i and %f", () => {
        it.each([
            ["%d", [42], "42"],
            ["%d", [undefined], "%d"],
            ["%d", [null], "%d"],
            ["%d", ["42.0"], "42"],
            ["%d %d", ["42"], "42 %d"],
            ["%d%d", [11, 22], "1122"],
            ["%f", [42.99], "42.99"],
            ["%i", [42.99], "42"],
            ["%i", ["42.99"], "42"],
            ["%i", [null], "%i"],
            ["foo %i", [42], "foo 42"],
        ])("should format %s", (f, a, expected) => {
            expect.assertions(1);

            expect(format(f, a)).toBe(expected);
        });

        it("should coerce BigInt through the numeric specifiers", () => {
            expect.assertions(2);

            expect(format("%d", [42n])).toBe("42");
            expect(format("%i", [42n])).toBe("42");
        });
    });

    describe("%j, %o and %O", () => {
        it.each([
            ["%j", [42], "42"],
            ["%j", [undefined], "%j"],
            ["%j", [null], "null"],
            ["%j", ["42"], "'42'"],
            ["%j", [{ s: "\"quoted\"" }], String.raw`{"s":"\"quoted\""}`],
            ["foo %j", [{ foo: "foo" }], "foo {\"foo\":\"foo\"}"],
            ["foo %j", [function foo() {}], "foo [Function: foo]"],
            // eslint-disable-next-line func-names
            ["foo %j", [function () {}], "foo [Function: <anonymous>]"],
            ["foo %o", [{ foo: "foo" }], "foo {\"foo\":\"foo\"}"],
            ["foo %O", [{ foo: "foo" }], "foo {\"foo\":\"foo\"}"],
        ])("should format %s", (f, a, expected) => {
            expect.assertions(1);

            expect(format(f, a)).toBe(expected);
        });

        it("should fall back to the circular marker when JSON.stringify throws", () => {
            expect.assertions(3);

            const circularObject: Record<string, unknown> = {};

            circularObject.self = circularObject;

            expect(format("%j", [circularObject])).toBe("\"[Circular]\"");
            expect(format("foo %j", [circularObject])).toBe("foo \"[Circular]\"");
            // `JSON.stringify` refuses BigInt in every runtime, so it takes the same guarded path.
            expect(format("%j", [10n])).toBe("\"[Circular]\"");
        });

        it("should honour a custom stringify", () => {
            expect.assertions(1);

            expect(format("foo %j", [{ foo: "foo" }], { stringify: () => "REPLACED" })).toBe("foo REPLACED");
        });
    });

    describe("%%", () => {
        it.each([
            ["%%", ["foo"], "%"],
            ["foo %%", ["foo"], "foo %"],
            ["foo %% %s", ["bar"], "foo % bar"],
            ["%d%%%d", [11, 22], "11%22"],
            ["%%%s%%", ["hi"], "%hi%"],
        ])("should format %s", (f, a, expected) => {
            expect.assertions(1);

            expect(format(f, a)).toBe(expected);
        });
    });

    describe("%c", () => {
        it.each([
            ["%cfoo", ["color: red"], "\u001B[31mfoo\u001B[0m"],
            ["%cfoo", ["color: red; background-color: blue"], "\u001B[44m\u001B[31mfoo\u001B[0m"],
            ["%cfoo%c bar", ["color: red", ""], "\u001B[31mfoo\u001B[39m bar\u001B[0m"],
            ["%cfoo %cbar", ["color:red", "color: blue"], "\u001B[31mfoo \u001B[34mbar\u001B[0m"],
        ])("should emit ANSI for %s because workerd has no window global", (f, a, expected) => {
            expect.assertions(1);

            expect(format(f, a)).toBe(expected);
        });

        it("should resolve truecolor and named CSS colors without any DOM", () => {
            expect.assertions(2);

            expect(format("%cfoo", ["color: #ff8800"])).toBe("\u001B[38;2;255;136;0mfoo\u001B[0m");
            expect(format("%cfoo", ["color: rebeccapurple"])).toBe("\u001B[38;2;102;51;153mfoo\u001B[0m");
        });

        it("should honour an explicit colors: false override", () => {
            expect.assertions(1);

            expect(format("%cfoo bar", ["color: red"], { colors: false })).toBe("foo bar");
        });
    });

    describe("exotic values", () => {
        it("should format Symbols", () => {
            expect.assertions(4);

            const symbol = Symbol("foo");

            expect(format("foo", [symbol])).toBe("foo");
            expect(format("%s", [symbol])).toBe("Symbol(foo)");
            expect(format("%j", [symbol])).toBe("undefined");
            expect(format("%d", [symbol])).toBe("NaN");
        });

        it("should serialize Errors as the empty object JSON gives them", () => {
            expect.assertions(3);

            const error = new Error("boom");

            const stringify = (value: unknown): string => {
                if (value instanceof Error) {
                    return `${value.name}: ${value.message}`;
                }

                return JSON.stringify(value);
            };

            // `Error` has no enumerable own properties, so `JSON.stringify` yields `{}` in every
            // runtime. There is no `util.inspect` fallback: the formatter is dependency-free by
            // design and callers wanting a stack must supply `options.stringify`.
            expect(format("%j", [error])).toBe("{}");
            expect(format("%s", [error])).toBe("{}");
            expect(format("%s", [error], { stringify })).toBe("Error: boom");
        });

        it("should format an object fmt by stringifying every value", () => {
            expect.assertions(2);

            expect(format({}, [])).toBe("{}");
            expect(format({}, ["a", "b"])).toBe("{} \"a\" \"b\"");
        });

        it("should throw a TypeError for a non-string, non-object fmt", () => {
            expect.assertions(2);

            // @ts-expect-error - invalid fmt
            expect(() => format(1)).toThrow("fmt must be a string or object, got number");
            expect(() => format(null)).toThrow("fmt must be a string or object, got null");
        });
    });

    describe("unknown specifiers and custom formatters", () => {
        it("should pass an unknown specifier through without consuming an argument", () => {
            expect.assertions(3);

            expect(format("%x %s", ["hello"])).toBe("%x hello");
            expect(format("%s %x %s", ["a", "b"])).toBe("a %x b");
            expect(format("%x%d", [42])).toBe("%x42");
        });

        it("should apply formatters keyed by codepoint", () => {
            expect.assertions(2);

            const tCode = "t".codePointAt(0) as number;
            const formatters: Record<string, FormatterFunction> = { [tCode]: (value) => `<${String(value)}>` };

            expect(format("x %t y", ["VAL"], { formatters })).toBe("x <VAL> y");
            expect(format("%t end", ["VAL"], { formatters })).toBe("<VAL> end");
        });

        it("should build a reusable formatter", () => {
            expect.assertions(3);

            const formatter = build({ formatters: { t: (ms: number) => new Date(ms).toISOString() } });
            const now = Date.UTC(2026, 0, 1);

            expect(formatter("%s%t%s", ["[", now, "]"])).toBe("[2026-01-01T00:00:00.000Z]");
            expect(() => build({ formatters: { haha: () => "x" } })).toThrow("Formatter %haha has more than one character");
            // @ts-expect-error - invalid formatter
            expect(() => build({ formatters: { t: "x" } })).toThrow("Formatter for %t is not a function");
        });
    });

    describe("appendExtraArguments", () => {
        it("should append unconsumed arguments", () => {
            expect.assertions(3);

            expect(format("%s done", ["task", "extra"], { appendExtraArguments: true })).toBe("task done extra");
            expect(format("hi", [1, 2, 3], { appendExtraArguments: true })).toBe("hi 1 2 3");
            expect(format("hi", [new Error("boom")], { appendExtraArguments: true })).toBe("hi {}");
        });
    });
});
