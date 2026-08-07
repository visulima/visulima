import { describe, expect, it } from "vitest";

import { parse, parseAll, YAMLParseError } from "../src";

/**
 * Strict parsing is the default. It rejects spec violations that both `yaml`
 * and `js-yaml` are lenient about; passing `strict: false` relaxes exactly
 * those two checks (and nothing else). Each case throws by default and parses
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

    it("parses ordinary documents identically with and without strict", () => {
        expect.assertions(2);

        const input = "name: visulima\nlist:\n  - 1\n  - 2\nnested:\n  a: true\n";
        const expected = { list: [1, 2], name: "visulima", nested: { a: true } };

        expect(parse(input)).toStrictEqual(expected);
        expect(parse(input, { strict: false })).toStrictEqual(expected);
    });
});
