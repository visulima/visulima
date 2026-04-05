import { describe, expect, it } from "vitest";

import { sortPackageJson } from "../src/index";

describe("sortPackageJson", () => {
    it("should sort package.json fields", () => {
        const input = JSON.stringify({
            dependencies: { b: "1.0.0", a: "2.0.0" },
            version: "1.0.0",
            name: "test-package",
            description: "A test package",
        });

        const result = sortPackageJson(input);
        const parsed = JSON.parse(result) as Record<string, unknown>;
        const keys = Object.keys(parsed);

        // name should come before version, version before description, description before dependencies
        expect(keys.indexOf("name")).toBeLessThan(keys.indexOf("version"));
        expect(keys.indexOf("version")).toBeLessThan(keys.indexOf("description"));
        expect(keys.indexOf("description")).toBeLessThan(keys.indexOf("dependencies"));
    });

    it("should sort dependencies alphabetically", () => {
        const input = JSON.stringify({
            name: "test",
            dependencies: { c: "1.0.0", a: "1.0.0", b: "1.0.0" },
        });

        const result = sortPackageJson(input);
        const parsed = JSON.parse(result) as { dependencies: Record<string, string> };
        const depKeys = Object.keys(parsed.dependencies);

        expect(depKeys).toEqual(["a", "b", "c"]);
    });

    it("should produce pretty output by default", () => {
        const input = JSON.stringify({ name: "test", version: "1.0.0" });
        const result = sortPackageJson(input);

        expect(result).toContain("\n");
    });

    it("should produce compact output when pretty is false", () => {
        const input = JSON.stringify({ name: "test", version: "1.0.0" });
        const result = sortPackageJson(input, { pretty: false });

        expect(result).not.toContain("\n");
    });

    it("should handle empty object", () => {
        const input = "{}";
        const result = sortPackageJson(input);

        expect(JSON.parse(result)).toEqual({});
    });

    it("should preserve all fields", () => {
        const input = JSON.stringify({
            scripts: { test: "vitest", build: "tsc" },
            name: "test",
            version: "1.0.0",
            license: "MIT",
        });

        const result = sortPackageJson(input);
        const parsed = JSON.parse(result) as Record<string, unknown>;

        expect(parsed).toHaveProperty("name", "test");
        expect(parsed).toHaveProperty("version", "1.0.0");
        expect(parsed).toHaveProperty("license", "MIT");
        expect(parsed).toHaveProperty("scripts");
    });
});
