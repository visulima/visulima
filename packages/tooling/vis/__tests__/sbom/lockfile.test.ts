import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readLockfilePackages } from "../../src/sbom/lockfile";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

/**
 * The raw parsers (npm/pnpm/yarn) and SRI decoder live in
 * `@visulima/package` and are covered by its own unit tests. These
 * tests exercise the vis-specific adapter: translating the cross-package
 * `{ algorithm, hex }` shape into CycloneDX's `{ alg, content }`, and
 * anchoring the lookup at `workspaceRoot` (no walking up).
 */
describe(readLockfilePackages, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-sbom-lockfile-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should translate sha512 integrity to CycloneDX's SHA-512 + hex content", () => {
        expect.assertions(3);

        const workspaceRoot = join(tmpDir, "repo");

        ensureDirSync(workspaceRoot);
        writeFileSync(
            join(workspaceRoot, "pnpm-lock.yaml"),
            `packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );

        const result = readLockfilePackages(workspaceRoot);

        expect(result?.type).toBe("pnpm");

        const lodash = result?.packages.get("lodash@4.17.21");

        expect(lodash?.name).toBe("lodash");
        // Truncated fixture digest doesn't match SHA-512's 128-hex-char length, so it's filtered.
        expect(lodash?.hash).toBeUndefined();
    });

    it("should prefer pnpm-lock.yaml over package-lock.json when both exist", () => {
        expect.assertions(1);

        const workspaceRoot = join(tmpDir, "repo");

        ensureDirSync(workspaceRoot);
        writeFileSync(
            join(workspaceRoot, "pnpm-lock.yaml"),
            `packages:

  a@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );
        writeFileSync(join(workspaceRoot, "package-lock.json"), JSON.stringify({ packages: {} }));

        expect(readLockfilePackages(workspaceRoot)?.type).toBe("pnpm");
    });

    it("should prefer pnpm-lock.yaml over npm-shrinkwrap.json when both exist", () => {
        expect.assertions(1);

        const workspaceRoot = join(tmpDir, "repo");

        ensureDirSync(workspaceRoot);
        writeFileSync(
            join(workspaceRoot, "pnpm-lock.yaml"),
            `packages:

  a@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );
        writeFileSync(join(workspaceRoot, "npm-shrinkwrap.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));

        expect(readLockfilePackages(workspaceRoot)?.type).toBe("pnpm");
    });

    it("should prefer npm-shrinkwrap.json over package-lock.json when both exist", () => {
        expect.assertions(2);

        const workspaceRoot = join(tmpDir, "repo");

        ensureDirSync(workspaceRoot);

        const npmLock = (pkg: string): string =>
            JSON.stringify({
                lockfileVersion: 3,
                packages: { [`node_modules/${pkg}`]: { version: "1.0.0" } },
            });

        writeFileSync(join(workspaceRoot, "npm-shrinkwrap.json"), npmLock("from-shrinkwrap"));
        writeFileSync(join(workspaceRoot, "package-lock.json"), npmLock("from-package-lock"));

        const result = readLockfilePackages(workspaceRoot);

        expect(result?.type).toBe("npm");
        expect([...(result?.packages.keys() ?? [])]).toStrictEqual(["from-shrinkwrap@1.0.0"]);
    });

    it("should return undefined when no supported lockfile exists at workspaceRoot", () => {
        expect.assertions(1);

        const workspaceRoot = join(tmpDir, "empty");

        ensureDirSync(workspaceRoot);

        expect(readLockfilePackages(workspaceRoot)).toBeUndefined();
    });

    it("should not walk up to find an ancestor lockfile", () => {
        expect.assertions(1);

        const ancestor = join(tmpDir, "ancestor");
        const workspaceRoot = join(ancestor, "inner");

        ensureDirSync(workspaceRoot);
        writeFileSync(
            join(ancestor, "pnpm-lock.yaml"),
            `packages:

  a@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );

        // The ancestor lockfile must be ignored — SBOM scope is bounded by
        // workspaceRoot, not by nearest-lockfile.
        expect(readLockfilePackages(workspaceRoot)).toBeUndefined();
    });
});
