import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverTemplates } from "../../src/generate/discover";

let workspace: string;

beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "vis-discover-"));
});

afterEach(() => {
    rmSync(workspace, { force: true, recursive: true });
});

describe(discoverTemplates, () => {
    // The following tests filter for the user-defined template by name.
    // The bundled `buildkite-ci` builtin always shows up in results too,
    // so length-1 assertions would be brittle.

    it("should discover native templates in .vis/templates/", () => {
        expect.assertions(1);

        const directory = join(workspace, ".vis", "templates");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "package.ts"), "export default { about: { name: 'p', description: '' }, produce: () => ({ files: {} }) };\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results.find((r) => r.name === "package")).toMatchObject({ name: "package", source: "native" });
    });

    it("should discover moon templates in .moon/templates/", () => {
        expect.assertions(1);

        const directory = join(workspace, ".moon", "templates", "thing");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "template.yml"), "title: Thing\ndescription: A thing\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results.find((r) => r.name === "thing")).toMatchObject({ name: "thing", source: "moon" });
    });

    it("should discover moon-format directories nested in .vis/templates/", () => {
        expect.assertions(1);

        const directory = join(workspace, ".vis", "templates", "moonish");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "template.yml"), "title: Moonish\ndescription: x\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results.find((r) => r.name === "moonish")).toMatchObject({ name: "moonish", source: "moon" });
    });

    it("should let native templates win over moon templates with the same name", () => {
        expect.assertions(2);

        const native = join(workspace, ".vis", "templates");
        const moon = join(workspace, ".moon", "templates", "shared");

        mkdirSync(native, { recursive: true });
        mkdirSync(moon, { recursive: true });
        writeFileSync(join(native, "shared.ts"), "export default {};\n");
        writeFileSync(join(moon, "template.yml"), "title: Shared\ndescription: x\n");

        const warnings: string[] = [];
        const results = discoverTemplates({ onWarning: (m) => warnings.push(m), workspaceRoot: workspace });

        expect(results.find((r) => r.name === "shared")).toMatchObject({ name: "shared", source: "native" });
        expect(warnings.some((w) => w.includes("multiple sources"))).toBe(true);
    });

    it("should pick up extra directories from config", () => {
        expect.assertions(1);

        const extraDirectory = join(workspace, "tools", "generators");

        mkdirSync(extraDirectory, { recursive: true });
        writeFileSync(join(extraDirectory, "extra.ts"), "export default {};\n");

        const results = discoverTemplates({ extraDirectories: [extraDirectory], workspaceRoot: workspace });

        expect(results.find((r) => r.name === "extra")?.source).toBe("config");
    });

    it("should return only builtin templates when no workspace templates are configured", () => {
        expect.assertions(2);

        const results = discoverTemplates({ workspaceRoot: workspace });

        // The package ships builtin presets (e.g. `buildkite-ci`); any
        // workspace with no `.vis/templates/` should still see them.
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((r) => r.source === "builtin")).toBe(true);
    });

    it("should expose the bundled `buildkite-ci` builtin template", () => {
        expect.assertions(2);

        const results = discoverTemplates({ workspaceRoot: workspace });
        const buildkite = results.find((r) => r.name === "buildkite-ci");

        expect(buildkite).toBeDefined();
        expect(buildkite?.source).toBe("builtin");
    });

    it("should let a user template override a builtin with the same name", () => {
        expect.assertions(1);

        const directory = join(workspace, ".vis", "templates", "buildkite-ci");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "template.yml"), "title: Custom Buildkite\ndescription: Vendored copy\n");

        const results = discoverTemplates({ workspaceRoot: workspace });
        const buildkite = results.find((r) => r.name === "buildkite-ci");

        // User vendored copy wins over the bundled preset.
        expect(buildkite?.source).toBe("moon");
    });

    it("should ignore .d.ts, .test.ts, .spec.ts, .config.ts, and *.map siblings", () => {
        expect.assertions(2);

        const directory = join(workspace, ".vis", "templates");

        mkdirSync(directory, { recursive: true });

        const body = "export default { about: { name: 'x', description: '' }, produce: () => ({ files: {} }) };\n";

        writeFileSync(join(directory, "package.ts"), body);
        writeFileSync(join(directory, "package.d.ts"), "export const x = 1;\n");
        writeFileSync(join(directory, "package.test.ts"), "test('x', () => {});\n");
        writeFileSync(join(directory, "package.spec.ts"), "test('x', () => {});\n");
        writeFileSync(join(directory, "package.config.ts"), "export const config = {};\n");
        writeFileSync(join(directory, "package.js.map"), "{}\n");

        const results = discoverTemplates({ workspaceRoot: workspace });
        const userResults = results.filter((r) => r.source === "native");

        expect(userResults).toHaveLength(1);
        expect(userResults[0]?.name).toBe("package");
    });
});
