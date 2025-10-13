import { fileURLToPath } from "node:url";

import type { TraceMap } from "@jridgewell/trace-mapping";
import { originalPositionFor } from "@jridgewell/trace-mapping";
import { dirname, join, toNamespacedPath } from "@visulima/path";
import { describe, expect, it } from "vitest";

import loadSourceMap from "../src/load-source-map";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__", "source-maps");

describe("load-source-map", () => {
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

        const expected = { column: 9, line: 15, name: "setState", source: join(FIXTURES_DIR, "src", "example.js") };

        expect(originalPositionFor(result as TraceMap, generated), "should have correct source mapping").toStrictEqual(expected);
    });

    it("should call back with error on external, missing sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "missingSourcemap.js");

        expect(() => loadSourceMap(path)).toThrow(
            `Error reading sourcemap for file "${toNamespacedPath(path)}":\nENOENT: no such file or directory, open '${toNamespacedPath(path.replace("missingSourcemap.js", "missing.js.map"))}'`,
        );
    });

    it("should call back with error on external, invalid sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "invalidSourcemap.js");

        expect(() => loadSourceMap(path)).toThrow(`Error parsing sourcemap for file "${toNamespacedPath(path)}":\n`);
    });

    it("should call back with error on inline, invalid sourcemap", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "invalidInlineSourcemap.js");

        expect(() => loadSourceMap(path)).toThrow(`Error parsing sourcemap for file "${toNamespacedPath(path)}":\n`);
    });

    it("should call back with error if source file does not exist", () => {
        expect.assertions(1);

        const path = join(FIXTURES_DIR, "nonExistant.js");

        expect(() => loadSourceMap(path)).toThrow(
            `Error reading sourcemap for file "${toNamespacedPath(path)}":\nENOENT: no such file or directory, open '${toNamespacedPath(path)}'`,
        );
    });
});
