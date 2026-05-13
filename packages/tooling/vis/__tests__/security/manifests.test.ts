import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readNodeModulesManifests } from "../../src/security/manifests";

const writePackageJson = (dir: string, name: string, version: string): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ license: "MIT", name, version }));
};

describe(readNodeModulesManifests, () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-manifests-"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("reads top-level manifests", () => {
        expect.assertions(2);

        writePackageJson(join(root, "node_modules", "lodash"), "lodash", "4.17.21");
        const map = readNodeModulesManifests(root);

        expect(map.get("lodash@4.17.21")).toBeDefined();
        expect(map.get("lodash@4.17.21")?.license).toBe("MIT");
    });

    it("reads scoped manifests under @scope/", () => {
        expect.assertions(1);

        writePackageJson(join(root, "node_modules", "@visulima", "fs"), "@visulima/fs", "1.0.0");
        const map = readNodeModulesManifests(root);

        expect(map.has("@visulima/fs@1.0.0")).toBe(true);
    });

    it("skips symlinked workspace packages (lstat protection)", () => {
        expect.assertions(2);

        const realPackage = join(root, "packages", "linked");

        writePackageJson(realPackage, "linked", "1.0.0");
        // Create node_modules with a symlink pointing at the real workspace package.
        mkdirSync(join(root, "node_modules"), { recursive: true });
        symlinkSync(realPackage, join(root, "node_modules", "linked"));

        const map = readNodeModulesManifests(root);

        // Symlink is skipped, so its manifest is not slurped.
        expect(map.has("linked@1.0.0")).toBe(false);
        // And the walk terminates instead of recursing back into the source tree.
        expect(map.size).toBe(0);
    });

    it("does not infinite-loop when node_modules contains a directory cycle (visited guard)", () => {
        expect.assertions(1);

        const nested = join(root, "node_modules", "pkg-a", "node_modules");

        writePackageJson(join(root, "node_modules", "pkg-a"), "pkg-a", "1.0.0");
        // Manually create a cycle: pkg-a/node_modules/pkg-a -> pkg-a/
        // (Using a symlink so this works without actually nesting forever.)
        mkdirSync(nested, { recursive: true });
        symlinkSync(join(root, "node_modules", "pkg-a"), join(nested, "pkg-a"));

        // If the walk doesn't terminate, the test will time out.
        const map = readNodeModulesManifests(root);

        expect(map.has("pkg-a@1.0.0")).toBe(true);
    });
});
