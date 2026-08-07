import { describe, expect, it } from "vitest";

import { parse, parseAll, stringify, YAMLParseError, YAMLStringifyError } from "../src";

const NESTING_DEPTH_ERROR = /nesting depth/;
const ALIAS_LIMIT_ERROR = /alias reference count/;

/**
 * Regression tests for the hardening pass. Every case here reproduced a real
 * defect: an input that hung the process, a guard that could be bypassed, or an
 * option that produced output which did not round-trip.
 */
describe("parser hardening", () => {
    it("rejects an unterminated verbatim tag instead of hanging", () => {
        expect.assertions(4);

        // The scan used to accept the EOF sentinel as a terminator and step the
        // cursor past the end, where `charCodeAt` returns NaN — which every
        // `ch !== 0` loop treats as content, spinning forever.
        for (const input of ["!<foo", "a: !<foo", "[!<foo", "!<"]) {
            expect(() => parse(input)).toThrow(YAMLParseError);
        }
    });

    it("still parses a terminated verbatim tag", () => {
        expect.assertions(1);

        expect(parse("!<foo> bar")).toBe("bar");
    });

    it("does not let a merge key bypass the prototype-pollution guard", () => {
        expect.assertions(3);

        const document = parse("defaults: &d\n  __proto__:\n    isAdmin: true\nuser:\n  <<: *d\n  name: bob\n") as {
            user: Record<string, unknown>;
        };

        // `__proto__` survives as plain data...
        expect(Object.keys(document.user)).toStrictEqual(["__proto__", "name"]);
        // ...but never reaches the prototype chain.
        expect(document.user.isAdmin).toBeUndefined();
        expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it("keeps security defaults when an option is present but undefined", () => {
        expect.assertions(4);

        // `parse(src, { maxAliasCount: config.maxAliasCount })` must not disable
        // the guard just because the config field was absent.
        expect(() => parse("a: 1\na: 2", { duplicateKeys: undefined })).toThrow(YAMLParseError);
        expect(() => parse("--- a: b", { strict: undefined })).toThrow(YAMLParseError);
        expect(() => parse("[".repeat(5000), { maxDepth: undefined })).toThrow(NESTING_DEPTH_ERROR);

        const bomb = `a: &a [x]\n${Array.from({ length: 200 }, (_, index) => `b${String(index)}: *a`).join("\n")}\n`;

        expect(() => parse(bomb, { maxAliasCount: undefined })).toThrow(ALIAS_LIMIT_ERROR);
    });

    it("bounds recursion depth with a YAMLParseError, not a RangeError", () => {
        expect.assertions(2);

        expect(() => parse("[".repeat(5000))).toThrow(YAMLParseError);
        expect(parse("[".repeat(20) + "]".repeat(20))).toBeDefined();
    });

    it("rejects non-string input at the trust boundary", () => {
        expect.assertions(3);

        expect(() => parse(null as unknown as string)).toThrow(YAMLParseError);
        expect(() => parse(42 as unknown as string)).toThrow(YAMLParseError);
        expect(() => parseAll({} as unknown as string)).toThrow(YAMLParseError);
    });

    it("rejects a core-schema tag whose content is outside its value space", () => {
        expect.assertions(4);

        // `!!bool no` used to resolve to `true` via `Boolean("no")`, inverting
        // the author's intent; `!!int zzz` used to yield NaN.
        expect(() => parse("a: !!bool no")).toThrow(YAMLParseError);
        expect(() => parse("a: !!int zzz")).toThrow(YAMLParseError);
        expect(parse("a: !!bool true")).toStrictEqual({ a: true });
        expect(parse("a: !!int 42")).toStrictEqual({ a: 42 });
    });

    it("keeps distinct complex keys distinct", () => {
        expect.assertions(2);

        // Every mapping key used to flatten to `[object Object]`, so two
        // different keys silently merged into one entry.
        expect(Object.keys(parse("? {x: 1}\n: first\n? {y: 2}\n: second\n") as object)).toHaveLength(2);
        // A sequence key must not collide with the plain string `a,b`.
        expect(Object.keys(parse("? [a, b]\n: 1\n\u0022a,b\u0022: 2\n") as object)).toHaveLength(2);
    });

    it("exposes the source snippet on the error mark", () => {
        expect.assertions(1);

        const thrown = (() => {
            try {
                parse("a:\n\tb: 1");
            } catch (error) {
                return error as YAMLParseError;
            }

            return undefined;
        })();

        expect(thrown?.mark?.snippet).toBeDefined();
    });
});

describe("serializer hardening", () => {
    it("round-trips nested collections at every flowLevel", () => {
        expect.assertions(4);

        // The block writers gated on `level + 1` but handed `writeNode` `level`,
        // so a block collection was spliced inline: `[[1,2],[3,4]]` at
        // flowLevel 1 emitted YAML that re-parsed as `[[1],2,[3],4]`.
        const value = [
            [1, 2],
            [3, 4],
        ];

        for (const flowLevel of [0, 1, 2, -1]) {
            expect(parse(stringify(value, { flowLevel }))).toStrictEqual(value);
        }
    });

    it("round-trips a deeply nested mapping at a mid flowLevel", () => {
        expect.assertions(1);

        const value = { a: { b: { c: [1, 2] } } };

        expect(parse(stringify(value, { flowLevel: 2 }))).toStrictEqual(value);
    });

    it("rejects an indent too narrow for a sequence marker", () => {
        expect.assertions(2);

        // `indent: 1` emitted `-value` with no separating space, which re-parses
        // as a single scalar rather than a sequence.
        expect(() => stringify(["a"], { indent: 1 })).toThrow(YAMLStringifyError);
        expect(parse(stringify(["hello world", "b"], { indent: 2 }))).toStrictEqual(["hello world", "b"]);
    });

    it("emits valid YAML when skipInvalid empties a nested collection", () => {
        expect.assertions(2);

        expect(parse(stringify({ a: { b: undefined } }, { skipInvalid: true }))).toStrictEqual({ a: {} });
        expect(parse(stringify([[undefined]], { skipInvalid: true }))).toStrictEqual([[]]);
    });

    it("reports a circular structure in flow style as a YAMLStringifyError", () => {
        expect.assertions(1);

        const circular: Record<string, unknown> = {};

        circular.self = circular;

        expect(() => stringify(circular, { flowLevel: 0 })).toThrow(YAMLStringifyError);
    });

    it("quotes a merge key so the document round-trips", () => {
        expect.assertions(1);

        expect(parse(stringify({ "<<": "x", a: 1 }))).toStrictEqual({ "<<": "x", a: 1 });
    });

    it("strips many trailing newlines in linear time", () => {
        expect.assertions(1);

        // `/\n+$/` is unanchored, so it retried at every offset — quadratic, and
        // reachable from untrusted input via a block scalar of blank lines.
        const started = performance.now();

        stringify({ a: `x${"\n".repeat(200_000)}` });

        expect(performance.now() - started).toBeLessThan(2000);
    });
});
