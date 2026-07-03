import { sortPackageJsonString, sortPackageJsonStringWithOptions } from "@visulima/vis/native";
import { describe, expect, it } from "vitest";

describe("sort-package-json native integration", () => {
    describe(sortPackageJsonString, () => {
        it("should sort package.json fields into conventional order", () => {
            expect.assertions(2);

            const input = JSON.stringify({
                dependencies: { a: "2.0.0", b: "1.0.0" },
                name: "test-package",
                version: "1.0.0",
            });

            const result = sortPackageJsonString(input);
            const keys = Object.keys(JSON.parse(result) as Record<string, unknown>);

            expect(keys.indexOf("name")).toBeLessThan(keys.indexOf("version"));
            expect(keys.indexOf("version")).toBeLessThan(keys.indexOf("dependencies"));
        });

        it("should sort dependencies alphabetically", () => {
            expect.assertions(1);

            const input = JSON.stringify({
                dependencies: { a: "1.0.0", b: "1.0.0", c: "1.0.0" },
                name: "test",
            });

            const result = sortPackageJsonString(input);
            const parsed = JSON.parse(result) as { dependencies: Record<string, string> };

            expect(Object.keys(parsed.dependencies)).toStrictEqual(["a", "b", "c"]);
        });

        it("should produce pretty output by default", () => {
            expect.assertions(1);

            const input = JSON.stringify({ name: "test", version: "1.0.0" });
            const result = sortPackageJsonString(input);

            expect(result).toContain("\n");
        });

        it("should preserve all fields", () => {
            expect.assertions(4);

            const input = JSON.stringify({
                license: "MIT",
                name: "test",
                scripts: { build: "tsc", test: "vitest" },
                version: "1.0.0",
            });

            const result = sortPackageJsonString(input);
            const parsed = JSON.parse(result) as Record<string, unknown>;

            expect(parsed).toHaveProperty("name", "test");
            expect(parsed).toHaveProperty("version", "1.0.0");
            expect(parsed).toHaveProperty("license", "MIT");
            expect(parsed).toHaveProperty("scripts");
        });

        it("should handle empty object", () => {
            expect.assertions(1);

            const result = sortPackageJsonString("{}");

            expect(JSON.parse(result)).toStrictEqual({});
        });
    });

    describe(sortPackageJsonStringWithOptions, () => {
        it("should produce compact output when pretty is false", () => {
            expect.assertions(1);

            const input = JSON.stringify({ name: "test", version: "1.0.0" });
            const result = sortPackageJsonStringWithOptions(input, { pretty: false });

            expect(result).not.toContain("\n");
        });

        it("should sort scripts when sortScripts is true", () => {
            expect.assertions(1);

            const input = JSON.stringify({
                name: "test",
                scripts: { build: "tsc", dev: "vite", test: "vitest" },
            });

            const result = sortPackageJsonStringWithOptions(input, { sortScripts: true });
            const parsed = JSON.parse(result) as { scripts: Record<string, string> };
            const scriptKeys = Object.keys(parsed.scripts);

            expect(scriptKeys).toStrictEqual(["build", "dev", "test"]);
        });

        it("should not sort scripts by default", () => {
            expect.assertions(1);

            // eslint-disable-next-line perfectionist/sort-objects
            const input = JSON.stringify({ name: "test", scripts: { test: "vitest", build: "tsc", dev: "vite" } });

            const result = sortPackageJsonStringWithOptions(input, { sortScripts: false });
            const parsed = JSON.parse(result) as { scripts: Record<string, string> };
            const scriptKeys = Object.keys(parsed.scripts);

            // Original insertion order preserved
            expect(scriptKeys).toStrictEqual(["test", "build", "dev"]);
        });

        it("should sort devDependencies alphabetically", () => {
            expect.assertions(1);

            const input = JSON.stringify({
                devDependencies: { eslint: "9.0.0", typescript: "5.0.0", vitest: "1.0.0" },
                name: "test",
            });

            const result = sortPackageJsonStringWithOptions(input, {});
            const parsed = JSON.parse(result) as { devDependencies: Record<string, string> };

            expect(Object.keys(parsed.devDependencies)).toStrictEqual(["eslint", "typescript", "vitest"]);
        });
    });
});
