import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { resolveWorkspacePatterns } from "../../src/config/workspace";

const makePackage = (root: string, relativeDirectory: string, name = "pkg"): void => {
    const directory = join(root, relativeDirectory);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
};

describe(resolveWorkspacePatterns, () => {
    it("should resolve a single-glob pattern to depth-1 directories with a package.json", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-simple-"));

        makePackage(root, "packages/a", "a");
        makePackage(root, "packages/b", "b");

        const result = resolveWorkspacePatterns(root, ["packages/*"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/a", "packages/b"]));
    });

    it("should resolve a single-glob pattern but skip directories without a package.json", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-skip-empty-"));

        makePackage(root, "packages/a", "a");
        mkdirSync(join(root, "packages/empty"), { recursive: true });

        const result = resolveWorkspacePatterns(root, ["packages/*"]);

        expect(result).toStrictEqual(["packages/a"]);
    });

    it("should resolve a nested-glob pattern (packages/*/*) to depth-2 packages", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-nested-"));

        // depth-2 — should match
        makePackage(root, "packages/api/server", "@scope/server");
        makePackage(root, "packages/tooling/vis", "@scope/vis");

        const result = resolveWorkspacePatterns(root, ["packages/*/*"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/api/server", "packages/tooling/vis"]));
    });

    it("should resolve a double-glob pattern (packages/**) recursively, only at directories holding package.json", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-doubleglob-"));

        makePackage(root, "packages/a", "a");
        makePackage(root, "packages/api/server", "@scope/server");
        makePackage(root, "packages/api/server/inner", "@scope/inner");

        const result = resolveWorkspacePatterns(root, ["packages/**"]);

        // Note: packages/api itself is intentionally absent — no package.json
        // lives at that level.
        expect(new Set(result)).toStrictEqual(new Set(["packages/a", "packages/api/server", "packages/api/server/inner"]));
    });

    it("should treat /*/* and /** equivalently (both walk recursively)", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-equivalence-"));

        makePackage(root, "packages/loose", "loose");
        makePackage(root, "packages/tooling/vis", "@scope/vis");

        const nested = resolveWorkspacePatterns(root, ["packages/*/*"]);
        const doubleGlob = resolveWorkspacePatterns(root, ["packages/**"]);

        // The regression fix routes both patterns to the recursive walker.
        // Before the fix, `packages/*/*` was mis-matched by `endsWith("/*")`
        // and routed to the depth-1 walker, returning [] for monorepos like
        // visulima itself (whose `packages/api/`, `packages/tooling/` shells
        // hold no package.json).
        expect(new Set(nested)).toStrictEqual(new Set(doubleGlob));
    });

    it("should find depth-2 packages.json under /*/* even when intermediate directories lack a package.json", () => {
        expect.assertions(1);

        // Regression guard: visulima's actual layout. `packages/api/` and
        // `packages/tooling/` are bare category directories; only their
        // children hold package.jsons.
        const root = mkdtempSync(join(tmpdir(), "vis-ws-bare-categories-"));

        makePackage(root, "packages/api/server", "@scope/server");
        makePackage(root, "packages/tooling/vis", "@scope/vis");

        const result = resolveWorkspacePatterns(root, ["packages/*/*"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/api/server", "packages/tooling/vis"]));
    });

    it("should resolve exact directory paths", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-exact-"));

        makePackage(root, "apps/web", "web");
        makePackage(root, "apps/api", "api");

        const result = resolveWorkspacePatterns(root, ["apps/web"]);

        expect(result).toStrictEqual(["apps/web"]);
    });

    it("should drop directories matching '!'-prefixed exclusion patterns", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-exclude-"));

        makePackage(root, "packages/a", "a");
        makePackage(root, "packages/b", "b");

        const result = resolveWorkspacePatterns(root, ["packages/*", "!packages/b"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/a"]));
    });

    it("should drop directories matching glob-style '!'-prefixed patterns", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-exclude-glob-"));

        makePackage(root, "packages/foo-app", "foo");
        makePackage(root, "packages/bar-app", "bar");
        makePackage(root, "packages/lib", "lib");

        // `*-app` is gitignore-style: matches names ending in `-app`
        // anywhere under `packages/`. Both `foo-app` and `bar-app` go.
        const result = resolveWorkspacePatterns(root, ["packages/*", "!packages/*-app"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/lib"]));
    });

    it("should drop directories listed in the workspace root .gitignore", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-gitignore-"));

        makePackage(root, "packages/keep", "keep");
        makePackage(root, "packages/generated", "generated");
        writeFileSync(join(root, ".gitignore"), "packages/generated/\n");

        const result = resolveWorkspacePatterns(root, ["packages/*"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/keep"]));
    });

    it("should support multiple patterns combined", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-multi-"));

        makePackage(root, "apps/web", "web");
        makePackage(root, "packages/api/server", "@scope/server");
        makePackage(root, "packages/tooling/vis", "@scope/vis");

        const result = resolveWorkspacePatterns(root, ["apps/*", "packages/*/*"]);

        expect(new Set(result)).toStrictEqual(new Set(["apps/web", "packages/api/server", "packages/tooling/vis"]));
    });

    it("should return an empty array when the base directory is missing", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-missing-"));

        const result = resolveWorkspacePatterns(root, ["packages/*", "packages/*/*", "packages/**"]);

        expect(result).toStrictEqual([]);
    });

    it("should tolerate trailing slashes on patterns", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-ws-trailing-"));

        makePackage(root, "packages/a", "a");
        makePackage(root, "packages/api/server", "@scope/server");

        const result = resolveWorkspacePatterns(root, ["packages/*/", "packages/*/*/"]);

        expect(new Set(result)).toStrictEqual(new Set(["packages/a", "packages/api/server"]));
    });
});
