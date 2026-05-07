import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverPackageJsonFiles } from "../../../src/commands/sort-package-json/handler";

let cwd: string;

const writeFile = (relativePath: string, content: string): void => {
    const fullPath = join(cwd, relativePath);

    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
};

const writeJson = (relativePath: string, data: unknown): void => {
    writeFile(relativePath, `${JSON.stringify(data, undefined, 2)}\n`);
};

describe(discoverPackageJsonFiles, () => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-sort-discover-"));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("returns the root package.json plus pnpm workspace members", () => {
        expect.assertions(2);

        writeJson("package.json", { name: "root" });
        writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
        writeJson("packages/foo/package.json", { name: "foo" });
        writeJson("packages/bar/package.json", { name: "bar" });

        const result = discoverPackageJsonFiles(cwd, []);

        expect(result.allFiles).toHaveLength(3);
        expect(result.files).toHaveLength(3);
    });

    it("skips package.json files inside .gitignored directories", () => {
        expect.assertions(1);

        writeJson("package.json", { name: "root" });
        writeFile(".gitignore", "dist/\n");
        writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/**'\n");
        writeJson("packages/foo/package.json", { name: "foo" });
        writeJson("packages/foo/dist/package.json", { name: "foo-dist" });

        const result = discoverPackageJsonFiles(cwd, []);

        // The workspace pattern resolver itself now honors the root
        // `.gitignore`, so `packages/foo/dist/` never makes it into the
        // candidate list — `allFiles`, `afterGitignore`, and `files` are
        // all the same length here. Earlier this assertion compared
        // `allFiles > files` to prove the per-file gitignore filter was
        // doing work; with the resolver-level filter that's no longer
        // a meaningful invariant.
        expect(result.files.map((f) => f.replace(`${cwd}/`, ""))).toStrictEqual(["package.json", "packages/foo/package.json"]);
    });

    it("skips package.json files inside workspace !-exclusions", () => {
        expect.assertions(1);

        writeJson("package.json", { name: "root" });
        writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/**'\n  - '!packages/foo/__fixtures__/**'\n");
        writeJson("packages/foo/package.json", { name: "foo" });
        writeJson("packages/foo/__fixtures__/sample/package.json", { name: "fixture" });

        const result = discoverPackageJsonFiles(cwd, []);

        expect(result.files.map((f) => f.replace(`${cwd}/`, ""))).toStrictEqual(["package.json", "packages/foo/package.json"]);
    });

    it("layers --ignore on top of gitignore + workspace exclusions", () => {
        expect.assertions(1);

        writeJson("package.json", { name: "root" });
        writeFile(".gitignore", "dist/\n");
        writeFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
        writeJson("packages/keep/package.json", { name: "keep" });
        writeJson("packages/skip-me/package.json", { name: "skip" });

        const result = discoverPackageJsonFiles(cwd, ["**/skip-me/**"]);

        expect(result.files.map((f) => f.replace(`${cwd}/`, ""))).toStrictEqual(["package.json", "packages/keep/package.json"]);
    });

    it("honors !-exclusions from npm-style package.json#workspaces", () => {
        expect.assertions(1);

        writeJson("package.json", {
            name: "root",
            workspaces: ["packages/**", "!packages/foo/__fixtures__/**"],
        });
        writeJson("packages/foo/package.json", { name: "foo" });
        writeJson("packages/foo/__fixtures__/sample/package.json", { name: "fixture" });

        const result = discoverPackageJsonFiles(cwd, []);

        expect(result.files.map((f) => f.replace(`${cwd}/`, ""))).toStrictEqual(["package.json", "packages/foo/package.json"]);
    });
});
