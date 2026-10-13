import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findGemspecs, GemspecReadError, parseGemspec, readGemVersionConstant, replaceGemLiteral } from "../../src/util/gemspec";

describe("util: gemspec", () => {
    let root: string;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-spec-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("reads the name, a literal version and runtime dependencies", () => {
        expect.hasAssertions();

        const info = parseGemspec(
            [
                "Gem::Specification.new do |spec|",
                "  spec.name = \"my-gem\"",
                "  spec.version = '1.2.3' # keep in step",
                "  spec.add_dependency \"rake\", \">= 10\"",
                "  spec.add_runtime_dependency(\"other\")",
                "end",
            ].join("\n"),
            "my-gem.gemspec",
        );

        expect(info.name).toStrictEqual({ line: 2, value: "my-gem" });
        expect(info.version).toStrictEqual({ kind: "literal", line: 3, value: "1.2.3" });
        expect(info.dependencies).toStrictEqual(["rake", "other"]);
    });

    it("reads Name::VERSION as a constant reference", () => {
        expect.hasAssertions();

        const info = parseGemspec("Gem::Specification.new do |s|\n  s.name = \"foo\"\n  s.version = Foo::VERSION\nend\n", "foo.gemspec");

        expect(info.version).toStrictEqual({ constant: "Foo::VERSION", kind: "constant", line: 3 });
    });

    it("refuses a one-line brace block whose version it cannot read", () => {
        expect.hasAssertions();

        expect(() => parseGemspec("Gem::Specification.new { |s| s.name = \"b\"; s.version = \"2.0.0\" }\n", "b.gemspec")).toThrow("cannot read");
    });

    it("refuses constructor arguments instead of reading them as an aggregate", () => {
        expect.hasAssertions();

        expect(() => parseGemspec("Gem::Specification.new(\"x\", \"1.0\") do |s|\n  s.name = \"x\"\nend\n", "x.gemspec")).toThrow("passes arguments");
    });

    it("refuses a version assignment on another receiver", () => {
        expect.hasAssertions();

        expect(() => parseGemspec("Gem::Specification.new do |spec|\n  spec.name = \"x\"\n  other.version = \"1.0.0\"\nend\n", "x.gemspec")).toThrow("cannot read");
    });

    it("has no version for an aggregate gemspec", () => {
        expect.hasAssertions();
        expect(parseGemspec("Gem::Specification.new do |spec|\n  spec.name = \"agg\"\nend\n", "agg.gemspec").version).toBeUndefined();
    });

    it.each([
        ["spec.version = \"1.0.#{x}\"", "not a string literal"],
        ["spec.version = compute_version", "not a string literal"],
        ["spec.name = \"a\"\n  spec.name = \"b\"", "set twice"],
        ["spec.version = \"1.0.0\"\n  spec.version = \"1.0.1\"", "set twice"],
    ])("refuses %s", (body, message) => {
        expect.hasAssertions();
        expect(() => parseGemspec(`Gem::Specification.new do |spec|\n  ${body}\nend\n`, "x.gemspec")).toThrow(message);
    });

    it("reads the one VERSION literal of a version file", () => {
        expect.hasAssertions();
        expect(readGemVersionConstant("module Foo\n  VERSION = \"2.0.0\"\nend\n", "version.rb")).toStrictEqual({ line: 2, value: "2.0.0" });
    });

    it("refuses a version file with an expression or two declarations", () => {
        expect.hasAssertions();
        expect(() => readGemVersionConstant("VERSION = \"1.\" + \"0\"\n", "version.rb")).toThrow(GemspecReadError);
        expect(() => readGemVersionConstant("VERSION = \"1.0.0\"\nVERSION = \"1.0.1\"\n", "version.rb")).toThrow("declares VERSION 2 times");
    });

    it("rewrites only the literal on the given line and keeps its quotes", () => {
        expect.hasAssertions();
        expect(replaceGemLiteral("a = \"x\"\n  spec.version = '1.0.0'\n", 2, "1.1.0")).toBe("a = \"x\"\n  spec.version = '1.1.0'\n");
    });

    it("finds gemspecs and skips vendor, node_modules and .bundle", () => {
        expect.hasAssertions();

        mkdirSync(join(root, "packages/a"), { recursive: true });
        mkdirSync(join(root, "vendor/b"), { recursive: true });
        mkdirSync(join(root, "node_modules/c"), { recursive: true });
        mkdirSync(join(root, ".bundle/d"), { recursive: true });
        writeFileSync(join(root, "packages/a/a.gemspec"), "");
        writeFileSync(join(root, "vendor/b/b.gemspec"), "");
        writeFileSync(join(root, "node_modules/c/c.gemspec"), "");
        writeFileSync(join(root, ".bundle/d/d.gemspec"), "");

        expect(findGemspecs(root)).toStrictEqual([join(root, "packages/a/a.gemspec")]);
    });
});
