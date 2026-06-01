import { readFileSync } from "node:fs";
import { dirname, join, toNamespacedPath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { originalPositionFor } from "@jridgewell/trace-mapping";
import { afterEach, describe, expect, it, vi } from "vitest";

import loadSourceMap from "../src/load-source-map";

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
});
