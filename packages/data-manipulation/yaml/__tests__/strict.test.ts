import { describe, expect, it } from "vitest";

import { parse, parseAll, YAMLParseError } from "../src";

/**
 * Strict parsing is the default. It rejects spec violations that both `yaml`
 * and `js-yaml` are lenient about; passing `strict: false` relaxes exactly
 * these checks (and nothing else). Each case throws by default and parses
 * under `{ strict: false }`.
 */
describe("strict mode (default)", () => {
    it("rejects a node property indented no deeper than its parent key", () => {
        expect.assertions(2);

        const input = "key: &x\n!!map\n  a: b\n";

        expect(() => parse(input)).toThrow(YAMLParseError);
        expect(parse(input, { strict: false })).toStrictEqual({ key: { a: "b" } });
    });

    it("rejects a block mapping that starts on the --- marker line", () => {
        expect.assertions(2);

        const input = "--- key1: value1\n    key2: value2\n";

        expect(() => parse(input)).toThrow("document start marker");
        expect(parse(input, { strict: false })).toStrictEqual({ key1: "value1", key2: "value2" });
    });

    it("rejects an anchored block mapping on the --- marker line", () => {
        expect.assertions(2);

        expect(() => parse("--- &anchor a: b\n")).toThrow(YAMLParseError);
        expect(parse("--- &anchor a: b\n", { strict: false })).toStrictEqual({ a: "b" });
    });

    it("rejects a block sequence that starts on the --- marker line", () => {
        expect.assertions(2);

        const input = "--- - a\n    - b\n";

        expect(() => parseAll(input)).toThrow("document start marker");
        expect(parseAll(input, { strict: false })).toStrictEqual([["a", "b"]]);
    });

    it("still accepts a flow collection or scalar on the --- marker line", () => {
        expect.assertions(3);

        expect(parse("--- {a: b}\n")).toStrictEqual({ a: "b" });
        expect(parse("--- [1, 2]\n")).toStrictEqual([1, 2]);
        expect(parse("--- scalar\n")).toBe("scalar");
    });

    it("still accepts a property on the --- line when the collection starts next line", () => {
        expect.assertions(1);

        expect(parse("--- !!map\na: b\n")).toStrictEqual({ a: "b" });
    });

    it("rejects two anchors (or two tags) on a single node", () => {
        expect.assertions(2);

        const input = "top: &node\n  &other value\n";

        expect(() => parse(input)).toThrow(YAMLParseError);
        expect(parse(input, { strict: false })).toStrictEqual({ top: "value" });
    });

    it("still accepts an anchored mapping whose first key is also anchored", () => {
        expect.assertions(1);

        // `&node` anchors the mapping, `&key` anchors its first key — two anchors
        // on two different nodes, which is valid.
        expect(parse("top: &node\n  &key k: v\n")).toStrictEqual({ top: { k: "v" } });
    });

    it("rejects a block scalar whose leading empty lines out-indent its content", () => {
        expect.assertions(2);

        const input = "x: >\n \n  \n   \n # c\n";

        expect(() => parse(input)).toThrow(YAMLParseError);
        expect(() => parse(input, { strict: false })).not.toThrow();
    });

    it("rejects a tab in block-scalar indentation but keeps tabs as content", () => {
        expect.assertions(2);

        expect(() => parse("foo: |\n\t\nbar: 1\n")).toThrow("tab characters");
        expect(parse("foo: |\n \t\nbar: 1\n")).toStrictEqual({ bar: 1, foo: "\t\n" });
    });

    it("parses a tag and anchor in either order on a mapping key", () => {
        expect.assertions(2);

        expect(parse("!!map\n&a !!str key: value\n")).toStrictEqual({ key: "value" });
        expect(parse("!!map\n!!str &a key: value\n")).toStrictEqual({ key: "value" });
    });

    it("parses ordinary documents identically with and without strict", () => {
        expect.assertions(2);

        const input = "name: visulima\nlist:\n  - 1\n  - 2\nnested:\n  a: true\n";
        const expected = { list: [1, 2], name: "visulima", nested: { a: true } };

        expect(parse(input)).toStrictEqual(expected);
        expect(parse(input, { strict: false })).toStrictEqual(expected);
    });
});
