import { describe, expect, it } from "vitest";

import { load, parse, parseAll, YAMLParseError } from "../src";

describe("parse › scalars", () => {
    it("resolves null in all core-schema spellings", () => {
        expect.assertions(6);

        expect(parse("~")).toBeNull();
        expect(parse("null")).toBeNull();
        expect(parse("Null")).toBeNull();
        expect(parse("NULL")).toBeNull();
        // An empty stream is `null` from `parse` and `undefined` from `load`,
        // matching `yaml` and `js-yaml` respectively.
        expect(parse("")).toBeNull();
        expect(load("")).toBeUndefined();
    });

    it("resolves booleans (1.2 core, not 1.1)", () => {
        expect.assertions(4);

        expect(parse("true")).toBe(true);
        expect(parse("False")).toBe(false);
        // 1.1-only spellings stay strings in 1.2
        expect(parse("yes")).toBe("yes");
        expect(parse("on")).toBe("on");
    });

    it("resolves integers in decimal, hex and octal", () => {
        expect.assertions(5);

        expect(parse("42")).toBe(42);
        expect(parse("-17")).toBe(-17);
        expect(parse("+5")).toBe(5);
        expect(parse("0x1A")).toBe(26);
        expect(parse("0o17")).toBe(15);
    });

    it("resolves floats including specials", () => {
        expect.assertions(5);

        expect(parse("3.14")).toBe(3.14);
        expect(parse("-0.5")).toBe(-0.5);
        expect(parse("1e3")).toBe(1000);
        expect(parse(".inf")).toBe(Number.POSITIVE_INFINITY);
        expect(parse(".nan")).toBeNaN();
    });

    it("keeps quoted scalars as strings", () => {
        expect.assertions(4);

        expect(parse(`"123"`)).toBe("123");
        expect(parse("'true'")).toBe("true");
        expect(parse(`"null"`)).toBe("null");
        expect(parse("'~'")).toBe("~");
    });

    it("decodes double-quoted escape sequences", () => {
        expect.assertions(3);

        expect(parse(String.raw`"a\tb"`)).toBe("a\tb");
        expect(parse(String.raw`"\u00e9"`)).toBe("é");
        expect(parse(String.raw`"line1\nline2"`)).toBe("line1\nline2");
    });

    it("handles single-quote escaping of quotes", () => {
        expect.assertions(1);

        expect(parse("'it''s'")).toBe("it's");
    });
});

describe("parse › block collections", () => {
    it("parses a simple mapping", () => {
        expect.assertions(1);

        expect(parse("foo: bar\nbaz: 2")).toStrictEqual({ baz: 2, foo: "bar" });
    });

    it("parses a simple sequence", () => {
        expect.assertions(1);

        expect(parse("- a\n- b\n- c")).toStrictEqual(["a", "b", "c"]);
    });

    it("parses nested mappings and sequences", () => {
        expect.assertions(1);

        const source = ["root:", "  list:", "    - 1", "    - 2", "  child:", "    name: test", "    flag: true"].join("\n");

        expect(parse(source)).toStrictEqual({
            root: {
                child: { flag: true, name: "test" },
                list: [1, 2],
            },
        });
    });

    it("parses a sequence of mappings", () => {
        expect.assertions(1);

        const source = ["- name: a", "  age: 1", "- name: b", "  age: 2"].join("\n");

        expect(parse(source)).toStrictEqual([
            { age: 1, name: "a" },
            { age: 2, name: "b" },
        ]);
    });

    it("supports sequences at the same indent as their key", () => {
        expect.assertions(1);

        const source = ["items:", "- one", "- two"].join("\n");

        expect(parse(source)).toStrictEqual({ items: ["one", "two"] });
    });

    it("treats an empty mapping value as null", () => {
        expect.assertions(1);

        expect(parse("a:\nb: 2")).toStrictEqual({ a: null, b: 2 });
    });
});

describe("parse › flow collections", () => {
    it("parses flow sequences", () => {
        expect.assertions(1);

        expect(parse("[1, 2, 3]")).toStrictEqual([1, 2, 3]);
    });

    it("parses flow mappings", () => {
        expect.assertions(1);

        expect(parse("{a: 1, b: 2}")).toStrictEqual({ a: 1, b: 2 });
    });

    it("parses nested flow collections", () => {
        expect.assertions(1);

        expect(parse("{list: [1, {x: 2}], name: test}")).toStrictEqual({ list: [1, { x: 2 }], name: "test" });
    });

    it("parses flow spanning multiple lines", () => {
        expect.assertions(1);

        expect(parse("[\n  1,\n  2,\n]")).toStrictEqual([1, 2]);
    });
});

describe("parse › multi-line scalars", () => {
    it("parses literal block scalars", () => {
        expect.assertions(1);

        const source = ["text: |", "  line1", "  line2", ""].join("\n");

        expect(parse(source)).toStrictEqual({ text: "line1\nline2\n" });
    });

    it("parses folded block scalars", () => {
        expect.assertions(1);

        const source = ["text: >", "  a", "  b", "", "  c", ""].join("\n");

        expect(parse(source)).toStrictEqual({ text: "a b\nc\n" });
    });

    it("honours strip and keep chomping indicators", () => {
        expect.assertions(2);

        expect(parse(["a: |-", "  x", "  y", ""].join("\n"))).toStrictEqual({ a: "x\ny" });
        expect(parse(["a: |+", "  x", "", ""].join("\n"))).toStrictEqual({ a: "x\n\n" });
    });

    it("folds plain scalars across lines", () => {
        expect.assertions(1);

        expect(parse(["a: one", "   two", "   three"].join("\n"))).toStrictEqual({ a: "one two three" });
    });
});

describe("parse › anchors, aliases and merge keys", () => {
    it("resolves anchors and aliases", () => {
        expect.assertions(1);

        const source = ["a: &anchor hello", "b: *anchor"].join("\n");

        expect(parse(source)).toStrictEqual({ a: "hello", b: "hello" });
    });

    it("shares the same reference for aliased collections", () => {
        expect.assertions(1);

        const source = ["base: &b", "  x: 1", "copy: *b"].join("\n");
        const result = parse(source) as { base: unknown; copy: unknown };

        expect(result.base).toBe(result.copy);
    });

    it("applies merge keys", () => {
        expect.assertions(1);

        const source = ["defaults: &d", "  adapter: postgres", "  host: localhost", "dev:", "  <<: *d", "  database: dev_db"].join("\n");

        expect(parse(source)).toStrictEqual({
            defaults: { adapter: "postgres", host: "localhost" },
            dev: { adapter: "postgres", database: "dev_db", host: "localhost" },
        });
    });

    it("does not merge an explicitly quoted << key", () => {
        expect.assertions(1);

        expect(parse(`"<<": value`)).toStrictEqual({ "<<": "value" });
    });

    it("guards against alias expansion bombs", () => {
        expect.assertions(1);

        const source = ["a: &a [x, x]", "b: &b [*a, *a]", "c: &c [*b, *b]", "d: [*c, *c, *c, *c]"].join("\n");

        expect(() => parse(source, { maxAliasCount: 5 })).toThrow(YAMLParseError);
    });
});

describe("parse › documents and directives", () => {
    it("parses multiple documents", () => {
        expect.assertions(1);

        expect(parseAll("---\na: 1\n---\nb: 2")).toStrictEqual([{ a: 1 }, { b: 2 }]);
    });

    it("parse() returns the first document and rejects multi-doc streams", () => {
        expect.assertions(2);

        expect(parse("---\nsolo: 1\n...")).toStrictEqual({ solo: 1 });
        expect(() => parse("---\na: 1\n---\nb: 2")).toThrow(YAMLParseError);
    });

    it("honours %TAG directives", () => {
        expect.assertions(1);

        const source = ["%TAG !e! tag:example.com,2000:app/", "---", "!e!foo bar"].join("\n");

        // The custom tag is recognised; the scalar value is preserved.
        expect(parse(source)).toBe("bar");
    });

    it("strips comments and blank lines", () => {
        expect.assertions(1);

        const source = ["# a comment", "a: 1 # inline", "", "# another", "b: 2"].join("\n");

        expect(parse(source)).toStrictEqual({ a: 1, b: 2 });
    });
});

describe("parse › errors and safety", () => {
    it("throws a positioned error on duplicate keys by default", () => {
        expect.assertions(2);

        let caught: unknown;

        try {
            parse("a: 1\na: 2");
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(YAMLParseError);
        expect((caught as YAMLParseError).mark?.line).toBe(1);
    });

    it("can overwrite or ignore duplicate keys", () => {
        expect.assertions(2);

        expect(parse("a: 1\na: 2", { duplicateKeys: "overwrite" })).toStrictEqual({ a: 2 });
        expect(parse("a: 1\na: 2", { duplicateKeys: "ignore" })).toStrictEqual({ a: 1 });
    });

    it("prevents prototype pollution", () => {
        expect.assertions(2);

        const result = parse("__proto__:\n  polluted: true\nsafe: 1") as Record<string, unknown>;

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(result.safe).toBe(1);
    });

    it("rejects unidentified aliases", () => {
        expect.assertions(1);

        expect(() => parse("a: *missing")).toThrow("unidentified alias");
    });
});
