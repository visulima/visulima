import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createVisWorkspaceReader } from "../../../src/release/core/readers/workspace";

/**
 * Integration test: writes a pnpm-workspace.yaml + package.jsons + project.jsons
 * into a temp directory and asserts the reader honours filters and produces the
 * right `PackageJsonReader` shape.
 */
describe(createVisWorkspaceReader, () => {
    let cwd: string;

    const writeProject = (relativePath: string, packageJson: Record<string, unknown>, projectJson?: Record<string, unknown>): void => {
        const dir = join(cwd, relativePath);

        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "package.json"), JSON.stringify(packageJson));

        if (projectJson) {
            writeFileSync(join(dir, "project.json"), JSON.stringify(projectJson));
        }
    };

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-wsreader-"));

        // pnpm-workspace.yaml — vis's workspace discovery reads this first.
        writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n  - 'apps/*'\n");

        // Root package.json so the workspace looks valid.
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "root", private: true, version: "0.0.0" }));

        // Two libraries with tags.
        writeProject("packages/a", { name: "@scope/a", version: "1.0.0" }, { projectType: "library", tags: ["type:package"] });
        writeProject("packages/b", { name: "@scope/b", version: "1.0.0" }, { projectType: "library", tags: ["type:package", "category:internal"] });

        // One application.
        writeProject("apps/web", { bin: "./bin.js", name: "@scope/web", version: "1.0.0" }, { projectType: "application", tags: ["type:app"] });

        // A directory under the glob with no package.json — should be skipped silently.
        mkdirSync(join(cwd, "packages", "empty"), { recursive: true });
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("enumerates every workspace project that has a package.json", async () => {
        expect.hasAssertions();

        const reader = createVisWorkspaceReader({ cwd });
        const result = await reader.listPackages();

        expect(result.map((r) => r.manifest.name).sort()).toStrictEqual(["@scope/a", "@scope/b", "@scope/web"]);
    });

    it("filters by project.json tag", async () => {
        expect.hasAssertions();

        const reader = createVisWorkspaceReader({ cwd, tag: "type:package" });
        const result = await reader.listPackages();

        expect(result.map((r) => r.manifest.name).sort()).toStrictEqual(["@scope/a", "@scope/b"]);
    });

    it("filters by projectType", async () => {
        expect.hasAssertions();

        const reader = createVisWorkspaceReader({ cwd, projectType: "application" });
        const result = await reader.listPackages();

        expect(result.map((r) => r.manifest.name)).toStrictEqual(["@scope/web"]);
    });

    it("composes tag + projectType filters", async () => {
        expect.hasAssertions();

        const reader = createVisWorkspaceReader({ cwd, projectType: "library", tag: "category:internal" });
        const result = await reader.listPackages();

        expect(result.map((r) => r.manifest.name)).toStrictEqual(["@scope/b"]);
    });

    it("returns absolute manifestPath usable by downstream consumers", async () => {
        expect.hasAssertions();

        const reader = createVisWorkspaceReader({ cwd, tag: "type:package" });
        const result = await reader.listPackages();
        const a = result.find((r) => r.manifest.name === "@scope/a");

        expect(a?.manifestPath).toBe(join(cwd, "packages", "a", "package.json"));
    });
});
