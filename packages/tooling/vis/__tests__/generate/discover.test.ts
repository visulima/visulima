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
    it("should discover native templates in .vis/templates/", () => {
        expect.assertions(2);

        const directory = join(workspace, ".vis", "templates");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "package.ts"), "export default { about: { name: 'p', description: '' }, produce: () => ({ files: {} }) };\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ name: "package", source: "native" });
    });

    it("should discover moon templates in .moon/templates/", () => {
        expect.assertions(2);

        const directory = join(workspace, ".moon", "templates", "thing");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "template.yml"), "title: Thing\ndescription: A thing\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ name: "thing", source: "moon" });
    });

    it("should discover moon-format directories nested in .vis/templates/", () => {
        expect.assertions(2);

        const directory = join(workspace, ".vis", "templates", "moonish");

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "template.yml"), "title: Moonish\ndescription: x\n");

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ name: "moonish", source: "moon" });
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

        expect(results[0]).toMatchObject({ name: "shared", source: "native" });
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

    it("should return [] when nothing is configured", () => {
        expect.assertions(1);

        const results = discoverTemplates({ workspaceRoot: workspace });

        expect(results).toStrictEqual([]);
    });
});
