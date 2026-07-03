import { readFileSync } from "node:fs";
import { dirname, join, toNamespacedPath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { originalPositionFor } from "@jridgewell/trace-mapping";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceMapReadError } from "../src/errors";
import loadSourceMap, { loadSourceMapAsync, loadSourceMapFromSource } from "../src/load-source-map";
import { SourceMapParseError } from "../src/parse-error";

const realFs = vi.hoisted(() => {
    return { readFileSync: undefined as unknown as typeof readFileSync };
});

vi.mock(import("node:fs"), async (importOriginal) => {
    const actual = await importOriginal();

    realFs.readFileSync = actual.readFileSync;

    return {
        ...actual,
        // Default to the real implementation so every test that does not opt into a
        // custom mock behaves exactly like the un-mocked module.
        readFileSync: vi.fn<typeof readFileSync>(actual.readFileSync),
    };
});

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "source-maps");

const mockedReadFileSync = vi.mocked(readFileSync);

describe("load-source-map", () => {
    afterEach(() => {
        // Restore delegation to the real implementation for the next test.
        mockedReadFileSync.mockImplementation(realFs.readFileSync);
    });

    it("should give back undefined as result if no sourcemap is referenced", () => {
        expect.assertions(1);

        const result = loadSourceMap(join(FIXTURES_DIR, "noSourcemap.js"));

        expect(result).toBeUndefined();
    });

    it("should handle inline sourcemaps", () => {
        expect.assertions(1);

        const result = loadSourceMap(join(FIXTURES_DIR, "lib-inline", "example.js"));

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: "src/example.js" };

        expect(originalPositionFor(result as TraceMap, generated), "should have correct source mapping").toStrictEqual(expected);
    });

    it("should handle external sourcemaps", () => {
        expect.assertions(1);

        const result = loadSourceMap(join(FIXTURES_DIR, "lib", "example.js"));

        const generated = { column: 13, line: 30 };

        const expected = { column: 9, line: 15, name: "setState", source: pathToFileURL(join(FIXTURES_DIR, "src", "example.js")).href };

        expect(originalPositionFor(result as TraceMap, generated), "should have correct source mapping").toStrictEqual(expected);
    });

    it("should call back with error on external, missing sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "missingSourcemap.js");
        const namespacedPath = toNamespacedPath(path);
        const mapPath = path.replace("missingSourcemap.js", "missing.js.map");
        const expectedError = `Error reading sourcemap for file "${namespacedPath}":\nENOENT: no such file or directory, open '${mapPath}'`;

        expect(() => loadSourceMap(path)).toThrow(expectedError);
    });

    it("should call back with error on external, invalid sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "invalidSourcemap.js");
        const namespacedPath = toNamespacedPath(path);
        const expectedError = `Error parsing sourcemap for file "${namespacedPath}":\n`;

        expect(() => loadSourceMap(path)).toThrow(expectedError);
    });

    it("should call back with error on inline, invalid sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "invalidInlineSourcemap.js");
        const namespacedPath = toNamespacedPath(path);
        const expectedError = `Error parsing sourcemap for file "${namespacedPath}":\n`;

        expect(() => loadSourceMap(path)).toThrow(expectedError);
    });

    it("should call back with error if source file does not exist", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "nonExistant.js");
        const namespacedPath = toNamespacedPath(path);
        const expectedError = `Error reading sourcemap for file "${namespacedPath}":\nENOENT: no such file or directory, open '${path}'`;

        expect(() => loadSourceMap(path)).toThrow(expectedError);
    });

    it("should resolve sourcemap referenced via a block-comment sourceMappingURL", () => {
        expect.assertions(1);

        const result = loadSourceMap(join(FIXTURES_DIR, "blockCommentSourcemap.js"));

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: pathToFileURL(join(FIXTURES_DIR, "src", "example.js")).href };

        expect(originalPositionFor(result as TraceMap, generated), "should resolve the relative .map path captured by the block-comment group").toStrictEqual(
            expected,
        );
    });

    it("should stringify a thrown non-Error value when reading fails", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "noSourcemap.js");
        const namespacedPath = toNamespacedPath(path);

        mockedReadFileSync.mockImplementation(() => {
            // The source under test only narrows `error instanceof Error`; a thrown
            // string exercises the `String(error)` fallback branch in enhanceError.
            // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throwing a non-Error to hit the String(error) branch
            throw "disk on fire";
        });

        expect(() => loadSourceMap(path)).toThrow(`Error reading sourcemap for file "${namespacedPath}":\ndisk on fire`);
    });

    it("should resolve a sourceMappingURL given as a file: URL", () => {
        expect.assertions(1);

        const mapUrl = pathToFileURL(join(FIXTURES_DIR, "lib", "example.js.map")).href;
        const source = `"use strict";\n//# sourceMappingURL=${mapUrl}\n`;

        const result = loadSourceMapFromSource(source, FIXTURES_DIR);

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: pathToFileURL(join(FIXTURES_DIR, "src", "example.js")).href };

        expect(originalPositionFor(result as TraceMap, generated)).toStrictEqual(expected);
    });

    it("should throw a SourceMapReadError that preserves the original error code on cause", () => {
        expect.assertions(3);

        const path = join(FIXTURES_DIR, "nonExistant.js");

        const error = ((): unknown => {
            try {
                loadSourceMap(path);
            } catch (error_: unknown) {
                return error_;
            }

            return undefined;
        })();

        expect(error).toBeInstanceOf(SourceMapReadError);
        expect((error as Error).cause).toBeInstanceOf(Error);
        expect(((error as Error).cause as NodeJS.ErrnoException).code).toBe("ENOENT");
    });

    it("should throw a SourceMapParseError on invalid map content", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "invalidSourcemap.js");

        expect(() => loadSourceMap(path)).toThrow(SourceMapParseError);
    });

    it("should not match a sourceMappingURL that is not inside a comment", () => {
        expect.assertions(1);

        const source = "const x = 'sourceMappingURL=example.js.map';\n";

        expect(loadSourceMapFromSource(source, FIXTURES_DIR)).toBeUndefined();
    });

    it("should return undefined for a remote sourceMappingURL without a resolver", () => {
        expect.assertions(1);

        const source = "//# sourceMappingURL=https://example.com/app.js.map\n";

        expect(loadSourceMapFromSource(source, FIXTURES_DIR)).toBeUndefined();
    });

    it("should fetch a remote sourceMappingURL via the remoteResolver hook", () => {
        expect.assertions(2);

        const mapContent = readFileSync(join(FIXTURES_DIR, "lib", "example.js.map"), { encoding: "utf8" });
        const source = "//# sourceMappingURL=https://example.com/example.js.map\n";

        const remoteResolver = vi.fn<(url: string) => string>((url: string) => {
            expect(url).toBe("https://example.com/example.js.map");

            return mapContent;
        });

        const result = loadSourceMapFromSource(source, FIXTURES_DIR, { remoteResolver });

        expect(result).toBeDefined();
    });

    it("should handle a block-comment sourceMappingURL via loadSourceMapFromSource", () => {
        expect.assertions(1);

        const source = "\"use strict\";\n/*# sourceMappingURL=lib/example.js.map */\n";

        const result = loadSourceMapFromSource(source, FIXTURES_DIR);

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: pathToFileURL(join(FIXTURES_DIR, "src", "example.js")).href };

        expect(originalPositionFor(result as TraceMap, generated)).toStrictEqual(expected);
    });

    it("should not stall on a pathological unterminated block comment (ReDoS guard)", () => {
        expect.assertions(1);

        // Lazy/overlapping whitespace in the old regex made this O(n^2); the linear
        // scanner returns immediately.
        const source = `/*# sourceMappingURL=${" ".repeat(200_000)}`;

        const start = performance.now();
        const result = loadSourceMapFromSource(source, FIXTURES_DIR);
        const elapsed = performance.now() - start;

        expect(result === undefined && elapsed < 1000).toBe(true);
    });

    it("should not stall on a terminated block comment whose anchor fails after a long whitespace run (ReDoS guard)", () => {
        expect.assertions(1);

        // Worst case for the old `([^*]+?)[ \t]*\*\/[ \t]*$` pattern: the lazy value
        // group and the trailing `[ \t]*` both match the spaces, the `*/` closes the
        // comment, and the trailing `x` breaks the line-end anchor (`[ \t]*$`),
        // forcing the regex engine to backtrack across every whitespace split — the
        // exact quadratic shape the linear scanner eliminates. The anchor must be
        // exercised here, per this repo's prior CodeQL ANSI-regex ReDoS guidance.
        const source = `/*# sourceMappingURL=app.js.map${" ".repeat(200_000)}*/ x\n`;

        const start = performance.now();
        const result = loadSourceMapFromSource(source, FIXTURES_DIR);
        const elapsed = performance.now() - start;

        // Trailing non-whitespace after `*/` is rejected (mirrors the original
        // `[ \t]*$`), and it must reject quickly rather than backtrack.
        expect(result === undefined && elapsed < 1000).toBe(true);
    });

    it("should not stall on a pathological line comment with no closing newline (ReDoS guard)", () => {
        expect.assertions(1);

        // A line-comment opener followed by a huge whitespace-only value with no
        // newline: the value is whitespace, so it is rejected, and the linear scan
        // bounds the work to a single forward pass.
        const source = `//# sourceMappingURL=${" ".repeat(200_000)}`;

        const start = performance.now();
        const result = loadSourceMapFromSource(source, FIXTURES_DIR);
        const elapsed = performance.now() - start;

        expect(result === undefined && elapsed < 1000).toBe(true);
    });
});

describe(loadSourceMapAsync, () => {
    it("should handle external sourcemaps", async () => {
        expect.assertions(1);

        const result = await loadSourceMapAsync(join(FIXTURES_DIR, "lib", "example.js"));

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: pathToFileURL(join(FIXTURES_DIR, "src", "example.js")).href };

        expect(originalPositionFor(result as TraceMap, generated)).toStrictEqual(expected);
    });

    it("should handle inline sourcemaps", async () => {
        expect.assertions(1);

        const result = await loadSourceMapAsync(join(FIXTURES_DIR, "lib-inline", "example.js"));

        const generated = { column: 13, line: 30 };
        const expected = { column: 9, line: 15, name: "setState", source: "src/example.js" };

        expect(originalPositionFor(result as TraceMap, generated)).toStrictEqual(expected);
    });

    it("should return undefined when no sourcemap is referenced", async () => {
        expect.assertions(1);

        const result = await loadSourceMapAsync(join(FIXTURES_DIR, "noSourcemap.js"));

        expect(result).toBeUndefined();
    });

    it("should throw a SourceMapReadError when the file does not exist", async () => {
        expect.assertions(2);

        const path = join(FIXTURES_DIR, "nonExistant.js");

        await expect(loadSourceMapAsync(path)).rejects.toBeInstanceOf(SourceMapReadError);
        await expect(loadSourceMapAsync(path)).rejects.toThrow("ENOENT");
    });

    it("should support an async remoteResolver", async () => {
        expect.assertions(1);

        const mapContent = readFileSync(join(FIXTURES_DIR, "lib", "example.js.map"), { encoding: "utf8" });
        const source = "//# sourceMappingURL=https://example.com/example.js.map\n";

        const temporaryFile = join(FIXTURES_DIR, "remoteRef.tmp.js");

        const { rmSync, writeFileSync } = await import("node:fs");

        writeFileSync(temporaryFile, source);

        try {
            const result = await loadSourceMapAsync(temporaryFile, {
                // eslint-disable-next-line @typescript-eslint/require-await -- exercises the async resolver branch
                remoteResolver: async () => mapContent,
            });

            expect(result).toBeDefined();
        } finally {
            rmSync(temporaryFile);
        }
    });
});
