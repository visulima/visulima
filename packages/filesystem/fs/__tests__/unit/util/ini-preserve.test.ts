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
});
