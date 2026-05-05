import { writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readJsonConfig, serializeConfigObject } from "../../../src/commands/migrate/shared";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-shared", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-shared-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(serializeConfigObject, () => {
        it("should unquote simple keys", () => {
            expect.assertions(2);

            const result = serializeConfigObject({ baz: 42, foo: "bar" });

            expect(result).toContain("foo:");
            expect(result).not.toContain('"foo":');
        });

        it("should pretty-print with 4-space indent", () => {
            expect.assertions(1);

            const result = serializeConfigObject({ nested: { a: 1 } });

            expect(result).toContain("    ");
        });
    });

    describe(readJsonConfig, () => {
        it("should return undefined for nonexistent file", () => {
            expect.assertions(1);

            expect(readJsonConfig(tmpDir, "missing.json")).toBeUndefined();
        });

        it("should parse a valid JSON file", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "test.json"), '{"key":"value"}');

            expect(readJsonConfig(tmpDir, "test.json")).toStrictEqual({ key: "value" });
        });

        it("should throw on invalid JSON", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "bad.json"), "{invalid");

            expect(() => readJsonConfig(tmpDir, "bad.json")).toThrow(/Failed to parse/);
        });
    });
});
