import { stringify } from "ini";
import { describe, expect, it } from "vitest";

import { detectIniStyle, mergeIniPreservingLines } from "../../../src/utils/ini-preserve";

const freshStringify = (data: Record<string, unknown>, section?: string): string => stringify(data, section === undefined ? {} : { section });

describe(detectIniStyle, () => {
    it("should detect LF line endings", () => {
        expect.assertions(1);

        const result = detectIniStyle("key=value\nother=1\n");

        expect(result.eol).toBe("\n");
    });

    it("should detect CRLF line endings", () => {
        expect.assertions(1);

        const result = detectIniStyle("key=value\r\nother=1\r\n");

        expect(result.eol).toBe("\r\n");
    });

    it("should detect whitespace-around-equals when most lines use it", () => {
        expect.assertions(1);

        const result = detectIniStyle("key = value\nother = 1\n");

        expect(result.whitespace).toBe(true);
    });

    it("should detect no-whitespace when most lines use no spaces", () => {
        expect.assertions(1);

        const result = detectIniStyle("key=value\nother=1\n");

        expect(result.whitespace).toBe(false);
    });

    it("should ignore comments and section headers when counting styles", () => {
        expect.assertions(2);

        const result = detectIniStyle("; comment line\n[section]\nkey = value\nother = 1\n");

        expect(result.whitespace).toBe(true);
        expect(result.eol).toBe("\n");
    });

    it("should treat tied counts (none) as non-whitespace", () => {
        expect.assertions(1);

        const result = detectIniStyle("");

        expect(result.whitespace).toBe(false);
    });

    it("should ignore lines without an equals sign when detecting style", () => {
        expect.assertions(1);

        // "plainword" has no '=' so parseKeyValue returns undefined and the line is skipped.
        const result = detectIniStyle("plainword\nkey = value\nother = 1\n");

        expect(result.whitespace).toBe(true);
    });

    it("should ignore lines whose key part is empty", () => {
        expect.assertions(1);

        // "=value" yields an empty key, so parseKeyValue returns undefined and it is skipped.
        const result = detectIniStyle("=value\nkey=value\nother=1\n");

        expect(result.whitespace).toBe(false);
    });
});

describe(mergeIniPreservingLines, () => {
    const style = { eol: "\n" as const, whitespace: false };

    it("should keep unchanged lines verbatim including inline comments", () => {
        expect.assertions(1);

        const original = "key=value ; keep me\nother=1\n";
        const old = { key: "value", other: 1 };
        const next = { key: "value", other: 2 };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("key=value ; keep me");
    });

    it("should rewrite only the value portion when value changes", () => {
        expect.assertions(2);

        const original = "key=value\nother=1\n";
        const old = { key: "value", other: 1 };
        const next = { key: "value", other: 99 };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("key=value");
        expect(merged).toContain("other=99");
    });

    it("should drop keys that are removed from nextData", () => {
        expect.assertions(2);

        const original = "key=value\nother=1\n";
        const old = { key: "value", other: 1 };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("key=value");
        expect(merged).not.toContain("other=");
    });

    it("should append newly added keys when section ends with a non-key trailing line", () => {
        expect.assertions(2);

        // A trailing blank/comment line triggers the addition-flush branch
        const original = "[main]\nkey=value\n; tail comment\n";
        const old = { main: { key: "value" } };
        const next = { main: { added: "new", key: "value" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("key=value");
        expect(merged).toContain("added=new");
    });

    it("should preserve blank lines and standalone comments", () => {
        expect.assertions(3);

        const original = "# comment\n\nkey=value\n";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("# comment");
        expect(merged).toContain("\n\n");
        expect(merged).toContain("key=value");
    });

    it("should preserve section headers verbatim", () => {
        expect.assertions(2);

        const original = "[server]\nhost=localhost\nport=8080\n";
        const old = { server: { host: "localhost", port: 8080 } };
        const next = { server: { host: "localhost", port: 9090 } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("[server]");
        expect(merged).toContain("port=9090");
    });

    it("should append new sections at the end when added", () => {
        expect.assertions(2);

        const original = "[server]\nhost=localhost\n";
        const old = { server: { host: "localhost" } };
        const next = { database: { url: "postgres://" }, server: { host: "localhost" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("[server]");
        expect(merged).toContain("[database]");
    });

    it("should preserve trailing whitespace before inline comments on key lines", () => {
        expect.assertions(1);

        const original = "key=value   ; trailing comment\n";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("key=value   ; trailing comment");
    });

    it("should preserve CRLF endings when style.eol is CRLF", () => {
        expect.assertions(1);

        const original = "key=value\r\nother=1\r\n";
        const old = { key: "value", other: 1 };
        const next = { key: "value", other: 2 };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, { eol: "\r\n", whitespace: false });

        expect(merged).toContain("\r\n");
    });

    it("should preserve leading indent on key lines", () => {
        expect.assertions(1);

        const original = "  key=value\n";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("  key=value");
    });

    it("should not add a trailing newline when the original lacks one", () => {
        expect.assertions(1);

        const original = "key=value";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged.endsWith("\n")).toBe(false);
    });

    it("should preserve a trailing newline when the original ends with one", () => {
        expect.assertions(1);

        const original = "key=value\n";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged.endsWith("\n")).toBe(true);
    });

    it("should keep unknown (non key/comment/header) lines verbatim", () => {
        expect.assertions(2);

        // "plainword" has no '=' so it is classified as an unknown line and kept verbatim.
        const original = "plainword\nkey=value\n";
        const old = { key: "value" };
        const next = { key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("plainword");
        expect(merged).toContain("key=value");
    });

    it("should rewrite a scalar value into a nested-object value", () => {
        expect.assertions(1);

        // Changing a scalar to an object forces the value token to be extracted from a
        // serialization that begins with a section header line ("[key]").
        const original = "key=value\n";
        const old = { key: "value" };
        const next = { key: { nested: "x" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        // The original "key=value" line keeps its prefix; the value token comes out empty
        // because the fresh serialization only produced a section header for "key".
        expect(merged).toContain("key=");
    });

    it("should drop a key when its whole section is removed from nextData", () => {
        expect.assertions(2);

        // The "[old]" section is absent from nextData, so flushAdditions sees no section data.
        const original = "[old]\nkey=value\n";
        const old = { old: { key: "value" } };
        const next = { kept: { other: "1" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).not.toContain("key=value");
        expect(merged).toContain("[kept]");
    });

    it("should not flush additions for a removed section that ends with a comment line", () => {
        expect.assertions(1);

        // The trailing comment is the last line of the removed "[old]" section, so the
        // section-end flush runs but finds no section data in nextData.
        const original = "[old]\nkey=value\n; trailing comment\n";
        const old = { old: { key: "value" } };
        const next = { kept: { other: "1" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).not.toContain("key=value");
    });

    it("should not append additions when a section ends with a comment and has no new keys", () => {
        expect.assertions(2);

        // All keys are already written, so the section-end flush finds no scalar additions.
        const original = "[main]\nkey=value\n; trailing comment\n";
        const old = { main: { key: "value" } };
        const next = { main: { key: "changed" } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("; trailing comment");
        expect(merged).toContain("key=changed");
    });

    it("should drop a key whose section path resolves to a non-object in nextData", () => {
        expect.assertions(1);

        // nextData.a is a scalar, so resolving the "a.b" section path returns undefined.
        const original = "[a.b]\nkey=value\n";
        const old = { a: { b: { key: "value" } } };
        const next = { a: "scalar" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).not.toContain("key=value");
    });

    it("should skip appending an entirely empty new section", () => {
        expect.assertions(1);

        const original = "key=value\n";
        const old = { key: "value" };
        const next = { empty: {}, key: "value" };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).not.toContain("[empty]");
    });

    it("should skip a new section that only contains nested objects (no scalars)", () => {
        expect.assertions(2);

        // "outer" has no scalar keys of its own, so its scalar-only flush is skipped,
        // but the nested "outer.inner" section is still appended.
        const original = "key=value\n";
        const old = { key: "value" };
        const next = { key: "value", outer: { inner: { a: "1" } } };

        const merged = mergeIniPreservingLines(original, old, next, freshStringify, style);

        expect(merged).toContain("[outer.inner]");
        expect(merged).toContain("a=1");
    });
});
