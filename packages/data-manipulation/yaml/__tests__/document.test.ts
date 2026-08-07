import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parseAllDocuments, parseDocument, YAMLParseError } from "../src";

const ROOT_NOT_MAPPING = /root is not a mapping/;

describe("parseDocument › diagnostics", () => {
    it("reports errors instead of throwing", () => {
        expect.assertions(3);

        const document = parseDocument("a:\n\tb: 1\n");

        expect(document.errors).toHaveLength(1);
        expect(document.errors[0]).toBeInstanceOf(YAMLParseError);
        expect(document.contents).toBeNull();
    });

    it("reports no errors for a valid document", () => {
        expect.assertions(2);

        const document = parseDocument("a: 1\nb: [2, 3]\n");

        expect(document.errors).toHaveLength(0);
        expect(document.toJS()).toStrictEqual({ a: 1, b: [2, 3] });
    });

    it("collects warnings without failing", () => {
        expect.assertions(2);

        const document = parseDocument("%FOO bar\n---\na: 1\n");

        expect(document.errors).toHaveLength(0);
        expect(document.warnings.length).toBeGreaterThan(0);
    });
});

describe("parseAllDocuments › recovery", () => {
    it("keeps parsing after a malformed document", () => {
        expect.assertions(4);

        const documents = parseAllDocuments("a: 1\n---\nb:\n\tc: 2\n---\nd: 3\n");

        expect(documents).toHaveLength(3);
        expect(documents[0]!.toJS()).toStrictEqual({ a: 1 });
        expect(documents[1]!.errors).toHaveLength(1);
        expect(documents[2]!.toJS()).toStrictEqual({ d: 3 });
    });

    it("returns one document per stream entry when all are valid", () => {
        expect.assertions(2);

        const documents = parseAllDocuments("---\na: 1\n---\nb: 2\n");

        expect(documents).toHaveLength(2);
        expect(documents.map((document) => document.toJS())).toStrictEqual([{ a: 1 }, { b: 2 }]);
    });
});

describe("document › reading", () => {
    it("reads nested values by path", () => {
        expect.assertions(5);

        const document = parseDocument("a:\n  b:\n    c: 1\nlist:\n  - x\n");

        expect(document.get("a")).toStrictEqual({ b: { c: 1 } });
        expect(document.getIn(["a", "b", "c"])).toBe(1);
        expect(document.getIn(["list", 0])).toBe("x");
        expect(document.hasIn(["a", "b"])).toBe(true);
        expect(document.hasIn(["a", "nope"])).toBe(false);
    });
});

describe("document › comment-preserving edits", () => {
    it("replaces an existing value without disturbing its comment", () => {
        expect.assertions(1);

        const document = parseDocument("a: 1\nb: 2 # note\n");

        document.setIn(["b"], 99);

        expect(document.toString()).toBe("a: 1\nb: 99 # note\n");
    });

    it("adds a key to an existing nested mapping", () => {
        expect.assertions(1);

        const source = "packages:\n  - 'packages/*'\n\n# keep this comment\noverrides:\n  foo: '1.0.0'\n";
        const document = parseDocument(source);

        document.setIn(["overrides", "vite-client"], "npm:pkg@1.2.3");

        expect(document.toString()).toBe("packages:\n  - 'packages/*'\n\n# keep this comment\noverrides:\n  foo: '1.0.0'\n  vite-client: npm:pkg@1.2.3\n");
    });

    it("creates the intermediate mapping when it is absent", () => {
        expect.assertions(1);

        const document = parseDocument("packages:\n  - 'a/*'\n\n# trailing comment\n");

        document.setIn(["overrides", "vite-client"], "npm:x@1");

        expect(document.toString()).toBe("packages:\n  - 'a/*'\n\n# trailing comment\noverrides:\n  vite-client: npm:x@1\n");
    });

    it("keeps every other byte of the file identical", () => {
        expect.assertions(2);

        const source = ["# header", "", "first: 1   # spaced comment", "", "nested:", "  deep:", "    value: keep", "", "last: true", ""].join("\n");
        const document = parseDocument(source);

        document.setIn(["nested", "deep", "value"], "changed");

        const output = document.toString();

        expect(output).toBe(source.replace("value: keep", "value: changed"));
        expect(parseDocument(output).toJS()).toStrictEqual({ first: 1, last: true, nested: { deep: { value: "changed" } } });
    });

    it("writes a collection value as an indented block", () => {
        expect.assertions(1);

        const document = parseDocument("root:\n  a: 1\n");

        document.setIn(["root", "list"], [1, 2]);

        expect(parseDocument(document.toString()).toJS()).toStrictEqual({ root: { a: 1, list: [1, 2] } });
    });

    it("reflects edits in the parsed view", () => {
        expect.assertions(2);

        const document = parseDocument("a: 1\n");

        document.setIn(["b", "c"], 2);

        expect(document.getIn(["b", "c"])).toBe(2);
        expect(parseDocument(document.toString()).toJS()).toStrictEqual({ a: 1, b: { c: 2 } });
    });

    it("applies several edits in one pass", () => {
        expect.assertions(1);

        const document = parseDocument("a: 1\nb: 2\nc: 3\n");

        document.setIn(["a"], "x");
        document.setIn(["c"], "z");

        expect(document.toString()).toBe("a: x\nb: 2\nc: z\n");
    });

    it("refuses to edit a document whose root is not a mapping", () => {
        expect.assertions(1);

        const document = parseDocument("- 1\n- 2\n");

        const edit = () => {
            document.setIn(["a"], 1);
        };

        expect(edit).toThrow(ROOT_NOT_MAPPING);
    });

    it("builds a document from empty or comment-only source", () => {
        expect.assertions(3);

        const fromEmpty = parseDocument("");

        fromEmpty.setIn(["overrides", "pkg"], "npm:x@1");

        expect(fromEmpty.toString()).toBe("overrides:\n  pkg: npm:x@1\n");

        const fromComment = parseDocument("# keep\n");

        fromComment.setIn(["a"], 1);

        expect(fromComment.toString()).toBe("# keep\na: 1\n");
        expect(parseDocument(fromEmpty.toString()).toJS()).toStrictEqual({ overrides: { pkg: "npm:x@1" } });
    });

    it("returns the source unchanged when nothing was edited", () => {
        expect.assertions(1);

        const source = "a: 1 # untouched\n";

        expect(parseDocument(source).toString()).toBe(source);
    });
});
