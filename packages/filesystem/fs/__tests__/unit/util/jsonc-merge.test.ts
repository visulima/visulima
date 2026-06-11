import { describe, expect, it } from "vitest";

import mergeJsoncPreservingComments, { buildJsoncOutput, formattingFromIndent } from "../../../src/utils/jsonc-merge";

describe(formattingFromIndent, () => {
    it("should use space indentation for numeric indent", () => {
        expect.assertions(2);

        const result = formattingFromIndent(4);

        expect(result.insertSpaces).toBe(true);
        expect(result.tabSize).toBe(4);
    });

    it("should detect tab indentation when given a tab string", () => {
        expect.assertions(2);

        const result = formattingFromIndent("\t");

        expect(result.insertSpaces).toBe(false);
        expect(result.tabSize).toBe(1);
    });

    it("should detect tab indentation when string contains a tab", () => {
        expect.assertions(1);

        const result = formattingFromIndent("\t\t");

        expect(result.insertSpaces).toBe(false);
    });

    it("should use space indentation for whitespace-only string", () => {
        expect.assertions(2);

        const result = formattingFromIndent("  ");

        expect(result.insertSpaces).toBe(true);
        expect(result.tabSize).toBe(2);
    });

    it("should default to 2-space indentation for undefined", () => {
        expect.assertions(2);

        const result = formattingFromIndent(undefined);

        expect(result.insertSpaces).toBe(true);
        expect(result.tabSize).toBe(2);
    });

    it("should use length 1 fallback for empty string", () => {
        expect.assertions(2);

        const result = formattingFromIndent("");

        expect(result.insertSpaces).toBe(true);
        expect(result.tabSize).toBe(2);
    });
});

describe(mergeJsoncPreservingComments, () => {
    it("should leave identical values untouched", () => {
        expect.assertions(1);

        const original = '{\n  // keep\n  "a": 1\n}\n';
        const merged = mergeJsoncPreservingComments(original, { a: 1 }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toBe(original);
    });

    it("should update a changed leaf while preserving comments", () => {
        expect.assertions(2);

        const original = '{\n  // header\n  "a": 1\n}\n';
        const merged = mergeJsoncPreservingComments(original, { a: 2 }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain("// header");
        expect(merged).toContain('"a": 2');
    });

    it("should add a new key when missing in original", () => {
        expect.assertions(2);

        const original = '{\n  "a": 1\n}\n';
        const merged = mergeJsoncPreservingComments(original, { a: 1, b: 2 }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain('"a": 1');
        expect(merged).toContain('"b": 2');
    });

    it("should remove a key when absent from next", () => {
        expect.assertions(2);

        const original = '{\n  "a": 1,\n  "b": 2\n}\n';
        const merged = mergeJsoncPreservingComments(original, { a: 1 }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain('"a": 1');
        expect(merged).not.toContain('"b"');
    });

    it("should handle nested objects recursively", () => {
        expect.assertions(2);

        const original = '{\n  "nested": {\n    // keep\n    "x": 1\n  }\n}\n';
        const merged = mergeJsoncPreservingComments(original, { nested: { x: 2 } }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain("// keep");
        expect(merged).toContain('"x": 2');
    });

    it("should walk array elements when arrays match in length", () => {
        expect.assertions(1);

        const original = '{\n  "list": [1, 2, 3]\n}\n';
        const merged = mergeJsoncPreservingComments(original, { list: [1, 9, 3] }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain("9");
    });

    it("should replace arrays when lengths differ", () => {
        expect.assertions(3);

        const original = '{\n  "list": [1, 2, 3]\n}\n';
        const merged = mergeJsoncPreservingComments(original, { list: [1, 2] }, { insertSpaces: true, tabSize: 2 });

        expect(merged).toContain("1");
        expect(merged).toContain("2");
        expect(merged).not.toContain("3");
    });
});

describe(buildJsoncOutput, () => {
    it("should fresh-stringify when no existing text", () => {
        expect.assertions(1);

        const out = buildJsoncOutput(undefined, { a: 1 }, true, 2, "\n", undefined, undefined);

        expect(out).toBe('{\n  "a": 1\n}\n');
    });

    it("should append trailing newline when merge result lacks one", () => {
        expect.assertions(1);

        const original = '{\n  "a": 1\n}';

        const out = buildJsoncOutput(original, { a: 2 }, true, 2, "\n", undefined, undefined);

        expect(out.endsWith("\n")).toBe(true);
    });

    it("should fresh-stringify when preserveComments is false even if existingText is present", () => {
        expect.assertions(1);

        const original = '{\n  // hi\n  "a": 1\n}\n';
        const out = buildJsoncOutput(original, { a: 2 }, false, 2, "\n", undefined, undefined);

        expect(out).not.toContain("// hi");
    });

    it("should apply replacer when fresh-stringifying", () => {
        expect.assertions(2);

        const out = buildJsoncOutput(undefined, { keep: 1, secret: "x" }, true, 2, "\n", undefined, (key: string, value: unknown) =>
            key === "secret" ? undefined : value,
        );

        expect(out).toContain("keep");
        expect(out).not.toContain("secret");
    });
});
