import { describe, expect, it } from "vitest";

import { INPUT_URI_SCHEMES, InvalidInputUriError, looksLikeInputUri, parseInputUri } from "../../src/parse-input-uri";

describe(parseInputUri, () => {
    it("returns undefined for bare globs", () => {
        expect.assertions(3);

        expect(parseInputUri("src/**/*.ts")).toBeUndefined();
        expect(parseInputUri("{projectRoot}/src/**/*")).toBeUndefined();
        expect(parseInputUri("!{workspaceRoot}/dist/**")).toBeUndefined();
    });

    it("returns undefined for named-input refs", () => {
        expect.assertions(2);

        expect(parseInputUri("production")).toBeUndefined();
        expect(parseInputUri("default")).toBeUndefined();
    });

    it("parses file:// to a fileset", () => {
        expect.assertions(2);

        expect(parseInputUri("file://tsconfig.json")).toStrictEqual({ fileset: "tsconfig.json" });
        expect(parseInputUri("file://{workspaceRoot}/tsconfig.base.json")).toStrictEqual({
            fileset: "{workspaceRoot}/tsconfig.base.json",
        });
    });

    it("treats schemes case-insensitively (typo-catching)", () => {
        expect.assertions(3);

        expect(parseInputUri("FILE://tsconfig.json")).toStrictEqual({ fileset: "tsconfig.json" });
        expect(parseInputUri("Glob://src/**/*")).toStrictEqual({ fileset: "src/**/*" });
        expect(parseInputUri("ENV://NODE_ENV")).toStrictEqual({ env: "NODE_ENV" });
    });

    it("throws when file:// or glob:// has no body", () => {
        expect.assertions(2);

        expect(() => parseInputUri("file://")).toThrow(/requires a path or pattern/);
        expect(() => parseInputUri("glob://")).toThrow(/requires a path or pattern/);
    });

    it("parses glob:// to a fileset", () => {
        expect.assertions(2);

        expect(parseInputUri("glob://src/**/*.ts")).toStrictEqual({ fileset: "src/**/*.ts" });
        expect(parseInputUri("glob://{projectRoot}/src/**/*")).toStrictEqual({
            fileset: "{projectRoot}/src/**/*",
        });
    });

    it("preserves negation on fileset URIs", () => {
        expect.assertions(2);

        expect(parseInputUri("!file://dist")).toStrictEqual({ fileset: "!dist" });
        expect(parseInputUri("!glob://dist/**")).toStrictEqual({ fileset: "!dist/**" });
    });

    it("parses env:// to an EnvironmentInput", () => {
        expect.assertions(1);

        expect(parseInputUri("env://NODE_ENV")).toStrictEqual({ env: "NODE_ENV" });
    });

    it("parses func:// to a RuntimeInput", () => {
        expect.assertions(1);

        expect(parseInputUri("func://node --version")).toStrictEqual({ runtime: "node --version" });
    });

    it("parses dep:// to an ExternalDependencyInput with one name", () => {
        expect.assertions(1);

        expect(parseInputUri("dep://lodash")).toStrictEqual({ externalDependencies: ["lodash"] });
    });

    it("parses dep:// with comma-separated names and trims whitespace", () => {
        expect.assertions(1);

        expect(parseInputUri("dep://lodash, react ,  vue")).toStrictEqual({
            externalDependencies: ["lodash", "react", "vue"],
        });
    });

    it("throws InvalidInputUriError for unknown schemes", () => {
        expect.assertions(2);

        expect(() => parseInputUri("gob://**/*")).toThrow(InvalidInputUriError);
        expect(() => parseInputUri("http://example.com")).toThrow(/Recognized schemes/);
    });

    it("throws when env:// has no body", () => {
        expect.assertions(1);

        expect(() => parseInputUri("env://")).toThrow(/requires a variable name/);
    });

    it("throws when func:// has no body", () => {
        expect.assertions(1);

        expect(() => parseInputUri("func://")).toThrow(/requires a command/);
    });

    it("throws when dep:// has no body or only-empty segments", () => {
        expect.assertions(1);

        expect(() => parseInputUri("dep://")).toThrow(/requires at least one dependency/);
    });

    it("throws when dep:// contains an empty segment (trailing or repeated comma)", () => {
        expect.assertions(3);

        expect(() => parseInputUri("dep://lodash,")).toThrow(/empty dependency segment/);
        expect(() => parseInputUri("dep://a,,b")).toThrow(/empty dependency segment/);
        expect(() => parseInputUri("dep://, ,")).toThrow(/empty dependency segment/);
    });

    it("rejects negation on non-fileset schemes", () => {
        expect.assertions(3);

        expect(() => parseInputUri("!env://NODE_ENV")).toThrow(/Negation is not supported/);
        expect(() => parseInputUri("!func://node --version")).toThrow(/Negation is not supported/);
        expect(() => parseInputUri("!dep://lodash")).toThrow(/Negation is not supported/);
    });

    it("exposes the recognized scheme list", () => {
        expect.assertions(1);

        expect([...INPUT_URI_SCHEMES]).toStrictEqual(["file", "glob", "env", "func", "dep"]);
    });
});

describe(looksLikeInputUri, () => {
    it("matches all recognized schemes (with and without negation)", () => {
        expect.assertions(10);

        for (const scheme of INPUT_URI_SCHEMES) {
            expect(looksLikeInputUri(`${scheme}://body`)).toBe(true);
            expect(looksLikeInputUri(`!${scheme}://body`)).toBe(true);
        }
    });

    it("does not match bare strings or token paths", () => {
        expect.assertions(3);

        expect(looksLikeInputUri("src/**/*.ts")).toBe(false);
        expect(looksLikeInputUri("{projectRoot}/foo")).toBe(false);
        expect(looksLikeInputUri("production")).toBe(false);
    });

    it("matches unknown schemes too (parseInputUri then surfaces the error)", () => {
        expect.assertions(1);

        // The predicate exists so callers can short-circuit other handling
        // before calling parseInputUri — surfacing typos as errors instead
        // of treating them as bare globs is intentional.
        expect(looksLikeInputUri("gob://**/*")).toBe(true);
    });
});
