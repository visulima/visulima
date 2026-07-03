import { describe, expect, it } from "vitest";

import { transformYamlBlockScalars } from "../src/transformers/yaml";

describe(transformYamlBlockScalars, () => {
    it("collapses a `|` block scalar onto the key line", () => {
        expect.assertions(2);

        const input = ['"token": |', "    gX69YO4CvBsVjzAwYxdG", "    yDd30t5+9ez31gKATtj4", ""].join("\n");

        const output = transformYamlBlockScalars(input);
        const lines = output.split("\n");

        expect(lines[0]).toBe('"token": "gX69YO4CvBsVjzAwYxdGyDd30t5+9ez31gKATtj4"');
        // Blank lines preserve the original line count so findings map 1:1.
        expect(lines).toHaveLength(input.split("\n").length);
    });

    it("collapses a `>` folded block scalar the same way", () => {
        expect.assertions(1);

        const input = ["key: >", "  hello", "  world", ""].join("\n");
        const lines = transformYamlBlockScalars(input).split("\n");

        expect(lines[0]).toBe('key: "helloworld"');
    });

    it("leaves untouched YAML alone byte-for-byte", () => {
        expect.assertions(1);

        const input = ["name: visulima", "version: 1.0.0", "list:", "  - a", "  - b"].join("\n");

        expect(transformYamlBlockScalars(input)).toBe(input);
    });

    it("preserves line numbers so findings map to original source", () => {
        expect.assertions(2);

        const input = ["# header comment", "name: sample", "secret: |", "    AKIAIOSFODNN7EXAMPLE", "    wJalrXUtnFEMI/K7MDENG", "trailer: end"].join("\n");

        const output = transformYamlBlockScalars(input);
        const outputLines = output.split("\n");

        // The collapsed scalar replaces line 3; lines 4 + 5 become blank;
        // `trailer: end` stays on its original line 6.
        expect(outputLines[2]).toBe('secret: "AKIAIOSFODNN7EXAMPLEwJalrXUtnFEMI/K7MDENG"');
        expect(outputLines[5]).toBe("trailer: end");
    });

    it("respects nested indentation when deciding block body", () => {
        expect.assertions(1);

        const input = ["outer:", "  token: |", "    abcd", "    efgh", "  sibling: value"].join("\n");
        const outputLines = transformYamlBlockScalars(input).split("\n");

        expect(outputLines[1]).toBe('  token: "abcdefgh"');
    });

    it("escapes quotes and backslashes inside the collapsed value", () => {
        expect.assertions(1);

        const input = ["key: |", String.raw`  has "quote" and \ backslash`].join("\n");
        const outputLines = transformYamlBlockScalars(input).split("\n");

        expect(outputLines[0]).toBe(String.raw`key: "has \"quote\" and \\ backslash"`);
    });

    it("preserves Windows line endings", () => {
        expect.assertions(1);

        const input = "key: |\r\n  body\r\ntail: x\r\n";

        expect(transformYamlBlockScalars(input)).toBe('key: "body"\r\n\r\ntail: x\r\n');
    });

    it("leaves an empty-body scalar as-is", () => {
        expect.assertions(1);

        const input = "key: |\nsibling: value\n";

        expect(transformYamlBlockScalars(input)).toBe(input);
    });
});
