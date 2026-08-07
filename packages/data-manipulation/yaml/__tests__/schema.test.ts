import { describe, expect, it } from "vitest";

import { parse, stringify, YAMLParseError } from "../src";

/**
 * Scalar resolution per schema. Expectations are cross-checked against the
 * `yaml` package, which is the reference for the non-core schemas.
 */
describe("schema › core (default)", () => {
    it("resolves the YAML 1.2 core set and nothing wider", () => {
        expect.assertions(2);

        expect(parse("a: true\nb: off\nc: ~\nd: .inf")).toStrictEqual({ a: true, b: "off", c: null, d: Number.POSITIVE_INFINITY });
        // 1.1-only shapes stay strings under core.
        expect(parse("a: 010\nb: 0b11\nc: 1_000\nd: 1:30")).toStrictEqual({ a: 10, b: "0b11", c: "1_000", d: "1:30" });
    });

    it("resolves hex and octal with the 1.2 prefixes", () => {
        expect.assertions(1);

        expect(parse("a: 0x1F\nb: 0o17")).toStrictEqual({ a: 31, b: 15 });
    });
});

describe("schema › failsafe", () => {
    it("leaves every scalar a string", () => {
        expect.assertions(2);

        expect(parse("a: 1\nb: true\nc: null\nd: ~", { schema: "failsafe" })).toStrictEqual({ a: "1", b: "true", c: "null", d: "~" });
        // Collections still nest; only scalar resolution changes.
        expect(parse("a:\n  - 1\n  - 2", { schema: "failsafe" })).toStrictEqual({ a: ["1", "2"] });
    });
});

describe("schema › json", () => {
    it("resolves the JSON grammar", () => {
        expect.assertions(1);

        expect(parse("{\"a\": 1, \"b\": true, \"c\": null, \"d\": 1.5e3}", { schema: "json" })).toStrictEqual({ a: 1, b: true, c: null, d: 1500 });
    });

    it("rejects any unquoted scalar outside the JSON grammar", () => {
        expect.assertions(3);

        // Matches `yaml`: even a bare mapping key is not a valid JSON scalar.
        expect(() => parse("a: 1", { schema: "json" })).toThrow(YAMLParseError);
        expect(() => parse("{\"a\": ~}", { schema: "json" })).toThrow(YAMLParseError);
        expect(() => parse("{\"a\": 0x1F}", { schema: "json" })).toThrow(YAMLParseError);
    });
});

describe("schema › yaml-1.1", () => {
    it("treats yes/no/on/off as booleans", () => {
        expect.assertions(2);

        expect(parse("a: yes\nb: no\nc: on\nd: off", { schema: "yaml-1.1" })).toStrictEqual({ a: true, b: false, c: true, d: false });
        // `y` and `n` are booleans too — this is the documented 1.1 footgun, and
        // matches `yaml`'s own compat expectation for `x: true\ny: off`.
        expect(parse("x: true\ny: off", { version: "1.1" })).toStrictEqual({ true: false, x: true });
    });

    it("resolves the wider 1.1 integer forms", () => {
        expect.assertions(2);

        expect(parse("a: 010\nb: 0b11\nc: 0x1F\nd: 1_000", { schema: "yaml-1.1" })).toStrictEqual({ a: 8, b: 3, c: 31, d: 1000 });
        expect(parse("a: -010\nb: +1_0", { schema: "yaml-1.1" })).toStrictEqual({ a: -8, b: 10 });
    });

    it("folds sexagesimals into base-60 values", () => {
        expect.assertions(2);

        expect(parse("a: 1:30", { schema: "yaml-1.1" })).toStrictEqual({ a: 90 });
        expect(parse("a: 1:30:00", { schema: "yaml-1.1" })).toStrictEqual({ a: 5400 });
    });

    it("resolves floats, infinities and NaN", () => {
        expect.assertions(3);

        expect(parse("a: 1.5\nb: .5\nc: 1_000.5", { schema: "yaml-1.1" })).toStrictEqual({ a: 1.5, b: 0.5, c: 1000.5 });
        expect(parse("a: -.inf", { schema: "yaml-1.1" })).toStrictEqual({ a: Number.NEGATIVE_INFINITY });
        expect(Number.isNaN((parse("a: .nan", { schema: "yaml-1.1" }) as { a: number }).a)).toBe(true);
    });

    it("resolves timestamps to Date", () => {
        expect.assertions(3);

        const date = (source: string): Date => (parse(source, { schema: "yaml-1.1" }) as { a: Date }).a;

        expect(date("a: 2001-12-15").toISOString()).toBe("2001-12-15T00:00:00.000Z");
        expect(date("a: 2001-12-15T02:59:43.1Z").toISOString()).toBe("2001-12-15T02:59:43.100Z");
        // A trailing offset is applied, not ignored.
        expect(date("a: 2001-12-14t21:59:43.10-05:00").toISOString()).toBe("2001-12-15T02:59:43.100Z");
    });

    it("keeps 1.2-only shapes as strings", () => {
        expect.assertions(1);

        // `0o17` is a 1.2 octal spelling; 1.1 does not resolve it.
        expect(parse("a: 0o17", { schema: "yaml-1.1" })).toStrictEqual({ a: "0o17" });
    });

    it("lets an explicit schema override the version default", () => {
        expect.assertions(2);

        expect(parse("a: off", { version: "1.1" })).toStrictEqual({ a: false });
        expect(parse("a: off", { schema: "core", version: "1.1" })).toStrictEqual({ a: "off" });
    });
});

describe("parse options", () => {
    it("resolves integers as BigInt without losing precision", () => {
        expect.assertions(2);

        // 9007199254740993 is not representable as a double.
        expect(parse("a: 9007199254740993", { intAsBigInt: true })).toStrictEqual({ a: 9_007_199_254_740_993n });
        expect(parse("a: 1.5", { intAsBigInt: true })).toStrictEqual({ a: 1.5 });
    });

    it("builds Maps and keeps complex keys native under mapAsMap", () => {
        expect.assertions(2);

        const result = parse("? [a, b]\n: 1", { mapAsMap: true }) as Map<unknown, unknown>;

        expect(result).toBeInstanceOf(Map);
        expect([...result.keys()][0]).toStrictEqual(["a", "b"]);
    });

    it("flattens keys under stringKeys even with mapAsMap", () => {
        expect.assertions(1);

        const result = parse("? [a, b]\n: 1", { mapAsMap: true, stringKeys: true }) as Map<unknown, unknown>;

        expect([...result.keys()]).toStrictEqual(["[a,b]"]);
    });

    it("treats << as an ordinary key when merge is disabled", () => {
        expect.assertions(2);

        const source = "d: &d { a: 1 }\nx:\n  <<: *d\n  b: 2\n";

        expect(parse(source)).toStrictEqual({ d: { a: 1 }, x: { a: 1, b: 2 } });
        expect(parse(source, { merge: false })).toStrictEqual({ d: { a: 1 }, x: { "<<": { a: 1 }, b: 2 } });
    });

    it("applies a reviver, dropping entries that return undefined", () => {
        expect.assertions(1);

        const revived = parse("a: 1\nb: 2\nc: 3", {
            reviver: (key, value) => {
                if (key === "b") {
                    return undefined;
                }

                return typeof value === "number" ? value * 10 : value;
            },
        });

        expect(revived).toStrictEqual({ a: 10, c: 30 });
    });
});

describe("stringify options", () => {
    it("honours the scalar keyword overrides", () => {
        expect.assertions(1);

        expect(stringify({ a: null, b: true, c: false }, { falseStr: "no", nullStr: "~", trueStr: "yes" })).toBe("a: ~\nb: yes\nc: no\n");
    });

    it("forces a collection style", () => {
        expect.assertions(2);

        expect(stringify({ a: 1, b: [1, 2] }, { collectionStyle: "flow" })).toBe("{ a: 1, b: [ 1, 2 ] }\n");
        expect(stringify({ a: 1, b: [1, 2] }, { collectionStyle: "block", flowLevel: 0 })).toBe("a: 1\nb:\n  - 1\n  - 2\n");
    });

    it("can drop flow-collection padding", () => {
        expect.assertions(1);

        expect(stringify({ a: 1, b: [1, 2] }, { collectionStyle: "flow", flowCollectionPadding: false })).toBe("{a: 1, b: [1, 2]}\n");
    });

    it("can refuse block scalars for multi-line strings", () => {
        expect.assertions(2);

        expect(stringify({ a: "l1\nl2" })).toBe("a: |-\n  l1\n  l2\n");
        expect(stringify({ a: "l1\nl2" }, { blockQuote: false })).toBe("a: \"l1\\nl2\"\n");
    });

    it("singleQuote chooses how to quote, never whether to", () => {
        expect.assertions(2);

        // The key stays plain; only the value needed quoting. Matches `yaml`.
        expect(stringify({ a: "x: y" }, { singleQuote: true })).toBe("a: 'x: y'\n");
        expect(stringify({ a: "plain" }, { singleQuote: true })).toBe("a: plain\n");
    });
});
