import { beforeAll, describe, expect, it, vi } from "vitest";

import type { loadNativeBindings } from "../src/native-binding";

// Native addon integration tests - only run if addon is compiled
describe("sort-package-json native integration", () => {
    let native: Awaited<ReturnType<typeof loadNativeBindings>>;

    beforeAll(async () => {
        vi.resetModules();
        const { loadNativeBindings } = await import("../src/native-binding");

        native = loadNativeBindings();
    });

    describe.skipIf(!native)("sortPackageJsonString", () => {
        it("should sort package.json fields into conventional order", () => {
            expect.assertions(2);

            const input = JSON.stringify({
                dependencies: { a: "2.0.0", b: "1.0.0" },
                name: "test-package",
                version: "1.0.0",
            });

            const result = native!.sortPackageJsonString(input);
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

            const result = native!.sortPackageJsonString(input);
            const parsed = JSON.parse(result) as { dependencies: Record<string, string> };

            expect(Object.keys(parsed.dependencies)).toStrictEqual(["a", "b", "c"]);
        });

        it("should produce pretty output by default", () => {
            expect.assertions(1);

            const input = JSON.stringify({ name: "test", version: "1.0.0" });
            const result = native!.sortPackageJsonString(input);

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

            const result = native!.sortPackageJsonString(input);
            const parsed = JSON.parse(result) as Record<string, unknown>;

            expect(parsed).toHaveProperty("name", "test");
            expect(parsed).toHaveProperty("version", "1.0.0");
            expect(parsed).toHaveProperty("license", "MIT");
            expect(parsed).toHaveProperty("scripts");
        });

        it("should handle empty object", () => {
            expect.assertions(1);

            const result = native!.sortPackageJsonString("{}");

            expect(JSON.parse(result)).toStrictEqual({});
        });
    });

    describe.skipIf(!native)("sortPackageJsonStringWithOptions", () => {
        it("should produce compact output when pretty is false", () => {
            expect.assertions(1);

            const input = JSON.stringify({ name: "test", version: "1.0.0" });
            const result = native!.sortPackageJsonStringWithOptions(input, { pretty: false });

            expect(result).not.toContain("\n");
        });

        it("should sort scripts when sort_scripts is true", () => {
            expect.assertions(1);

            const input = JSON.stringify({
                name: "test",
                scripts: { build: "tsc", dev: "vite", test: "vitest" },
            });

            const result = native!.sortPackageJsonStringWithOptions(input, { sort_scripts: true });
            const parsed = JSON.parse(result) as { scripts: Record<string, string> };
            const scriptKeys = Object.keys(parsed.scripts);

            expect(scriptKeys).toStrictEqual(["build", "dev", "test"]);
        });

        it("should not sort scripts by default", () => {
            expect.assertions(1);

            const input = JSON.stringify({
                name: "test",
                scripts: { build: "tsc", dev: "vite", test: "vitest" },
            });

            const result = native!.sortPackageJsonStringWithOptions(input, { sort_scripts: false });
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

            const result = native!.sortPackageJsonStringWithOptions(input, {});
            const parsed = JSON.parse(result) as { devDependencies: Record<string, string> };

            expect(Object.keys(parsed.devDependencies)).toStrictEqual(["eslint", "typescript", "vitest"]);
        });
    });
});
