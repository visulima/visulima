import { describe, expect, it } from "vitest";

import { parse, stringify, YAMLStringifyError } from "../src";

describe("stringify › scalars", () => {
    it("emits primitive scalars", () => {
        expect.assertions(5);

        expect(stringify("hello")).toBe("hello\n");
        expect(stringify(42)).toBe("42\n");
        expect(stringify(true)).toBe("true\n");
        expect(stringify(null)).toBe("null\n");
        expect(stringify(3.14)).toBe("3.14\n");
    });

    it("quotes strings that would otherwise resolve to another type", () => {
        expect.assertions(4);

        expect(stringify("true")).toBe("'true'\n");
        expect(stringify("123")).toBe("'123'\n");
        expect(stringify("null")).toBe("'null'\n");
        expect(stringify("~")).toBe("'~'\n");
    });

    it("quotes strings containing structural characters", () => {
        expect.assertions(3);

        expect(stringify("a: b")).toBe("'a: b'\n");
        expect(stringify("# not a comment")).toContain("'# not a comment'");
        expect(stringify(" leading")).toBe("' leading'\n");
    });

    it("represents float specials", () => {
        expect.assertions(3);

        expect(stringify(Number.POSITIVE_INFINITY)).toBe(".inf\n");
        expect(stringify(Number.NEGATIVE_INFINITY)).toBe("-.inf\n");
        expect(stringify(Number.NaN)).toBe(".nan\n");
    });

    it("uses literal block style for multi-line strings", () => {
        expect.assertions(1);

        expect(stringify("line1\nline2\n")).toBe("|\n  line1\n  line2\n");
    });

    it("round-trips strings with multiple trailing newlines (keep chomping)", () => {
        expect.assertions(5);

        // Regression: `|+` emission previously added one blank line too many.
        for (let newlines = 1; newlines <= 5; newlines += 1) {
            const value = `a${"\n".repeat(newlines)}`;

            expect(parse(stringify(value))).toBe(value);
        }
    });
});

describe("stringify › collections", () => {
    it("emits a block mapping", () => {
        expect.assertions(1);

        expect(stringify({ a: 1, b: "two" })).toBe("a: 1\nb: two\n");
    });

    it("emits a block sequence", () => {
        expect.assertions(1);

        expect(stringify(["a", "b"])).toBe("- a\n- b\n");
    });

    it("emits nested structures", () => {
        expect.assertions(1);

        const value = { root: { items: [1, 2], name: "x" } };

        expect(stringify(value)).toBe(["root:", "  items:", "    - 1", "    - 2", "  name: x", ""].join("\n"));
    });

    it("emits a compact sequence of mappings", () => {
        expect.assertions(1);

        const value = [{ id: 1 }, { id: 2 }];

        expect(stringify(value)).toBe(["- id: 1", "- id: 2", ""].join("\n"));
    });

    it("uses flow style for empty collections", () => {
        expect.assertions(2);

        expect(stringify({ a: [], b: {} })).toBe("a: []\nb: {}\n");
        expect(stringify([])).toBe("[]\n");
    });
});

describe("stringify › options", () => {
    it("honours a custom indent", () => {
        expect.assertions(1);

        expect(stringify({ a: { b: 1 } }, { indent: 4 })).toBe("a:\n    b: 1\n");
    });

    it("sorts keys when requested", () => {
        expect.assertions(1);

        expect(stringify({ a: 2, b: 3, c: 1 }, { sortKeys: true })).toBe("a: 2\nb: 3\nc: 1\n");
    });

    it("supports flow style via flowLevel", () => {
        expect.assertions(1);

        expect(stringify({ a: [1, 2], b: { c: 3 } }, { flowLevel: 0 })).toBe("{a: [1, 2], b: {c: 3}}\n");
    });

    it("emits a document marker with directives:true", () => {
        expect.assertions(1);

        expect(stringify({ a: 1 }, { directives: true })).toBe("---\na: 1\n");
    });

    it("skips undefined-valued members when skipInvalid is set", () => {
        expect.assertions(1);

        expect(stringify({ a: 1, b: undefined, c: 3 }, { skipInvalid: true })).toBe("a: 1\nc: 3\n");
    });

    it("throws on circular structures", () => {
        expect.assertions(1);

        const value: Record<string, unknown> = {};

        value.self = value;

        expect(() => stringify(value)).toThrow(YAMLStringifyError);
    });
});

describe("stringify › round-trips through parse", () => {
    it.each([
        ["primitive map", { active: true, count: 3, name: "test" }],
        ["nested", { list: [1, 2, { deep: [true, null, "x"] }], meta: { a: 1 } }],
        ["strings needing quotes", { colon: "a: b", empty: "", num: "42", special: "line\nbreak\n" }],
        ["mixed array", [1, "two", true, null, { k: "v" }]],
        ["unicode", { emoji: "😀", greek: "αβγ" }],
    ])("round-trips %s", (_label, value) => {
        expect.assertions(1);

        expect(parse(stringify(value))).toStrictEqual(value);
    });
});
