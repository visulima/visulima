import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { filterDepInstances } from "../../src/util/json-deps-filter";
import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

const seedWorkspace = (): void => {
    writeJson("package.json", {
        devDependencies: { vitest: "^1.0.0" },
        name: "root",
        workspaces: ["packages/*"],
    });
    writeJson("packages/lib/package.json", {
        dependencies: { lodash: "^4.17.0" },
        name: "@scope/lib",
        version: "1.0.0",
    });
    writeJson("packages/app/package.json", {
        dependencies: { "@scope/lib": "workspace:*", react: "^18.2.0" },
        devDependencies: { vitest: "^1.0.0" },
        name: "@scope/app",
        peerDependencies: { typescript: "^5.0.0" },
    });
    writeJson("packages/internal-tools/package.json", {
        dependencies: { "@scope/lib": "workspace:*" },
        name: "@scope/internal-tools",
    });
};

describe(filterDepInstances, () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-json-deps-filter-"));
        seedWorkspace();
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("passes instances through unchanged when no filters are supplied", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances);

        expect(filtered).toHaveLength(instances.length);
        expect(filtered).toStrictEqual(instances);
    });

    it("internalOnly keeps only workspace-internal deps", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { internalOnly: true });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((instance) => instance.isInternal)).toBe(true);
    });

    it("externalOnly keeps only external/registry deps", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { externalOnly: true });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((instance) => !instance.isInternal)).toBe(true);
    });

    it("includePatterns filters declaring-package names via zeptomatch", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { includePatterns: ["@scope/app"] });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((instance) => instance.packageName === "@scope/app")).toBe(true);
    });

    it("excludePatterns drops declaring-package names via zeptomatch", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { excludePatterns: ["@scope/internal-*"] });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.some((instance) => instance.packageName === "@scope/internal-tools")).toBe(false);
    });

    it("depTypes whitelists which dep blocks survive", () => {
        expect.assertions(2);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { depTypes: ["devDependencies"] });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((instance) => instance.depType === "devDependencies")).toBe(true);
    });

    it("returns empty when internalOnly and externalOnly are both true", () => {
        expect.assertions(1);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, { externalOnly: true, internalOnly: true });

        expect(filtered).toStrictEqual([]);
    });

    it("treats empty filter arrays as no-op (does not match nothing)", () => {
        expect.assertions(1);

        const instances = iterateWorkspaceDeps(workspaceRoot);
        const filtered = filterDepInstances(instances, {
            depTypes: [],
            excludePatterns: [],
            includePatterns: [],
        });

        expect(filtered).toHaveLength(instances.length);
    });
});
