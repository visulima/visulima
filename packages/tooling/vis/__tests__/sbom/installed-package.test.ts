import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readInstalledPackageMetadata } from "../../src/sbom/installed-package";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

/**
 * Lays a `package.json` at `&lt;workspaceRoot>/&lt;relativeDir>/package.json`
 * and returns the fully-qualified package JSON object written.
 */
const writePackageJson = (workspaceRoot: string, relativeDir: string, pkg: Record<string, unknown>): void => {
    const dir = join(workspaceRoot, relativeDir);

    ensureDirSync(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
};

describe(readInstalledPackageMetadata, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-installed-package-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should return metadata from pnpm's virtual store when it exists", () => {
        expect.assertions(2);

        writePackageJson(tmpDir, "node_modules/.pnpm/lodash@4.17.21/node_modules/lodash", {
            license: "MIT",
            name: "lodash",
            version: "4.17.21",
        });

        const result = readInstalledPackageMetadata(tmpDir, "lodash", "4.17.21");

        expect(result?.version).toBe("4.17.21");
        expect(result?.license).toBe("MIT");
    });

    it("should translate `/` to `+` for scoped names in the pnpm virtual store path", () => {
        expect.assertions(2);

        writePackageJson(tmpDir, "node_modules/.pnpm/@visulima+fs@5.0.0/node_modules/@visulima/fs", {
            license: "MIT",
            name: "@visulima/fs",
            version: "5.0.0",
        });

        const result = readInstalledPackageMetadata(tmpDir, "@visulima/fs", "5.0.0");

        expect(result?.name).toBe("@visulima/fs");
        expect(result?.version).toBe("5.0.0");
    });

    it("should fall back to the hoisted copy when its version matches", () => {
        expect.assertions(2);

        writePackageJson(tmpDir, "node_modules/lodash", {
            license: "MIT",
            name: "lodash",
            version: "4.17.21",
        });

        const result = readInstalledPackageMetadata(tmpDir, "lodash", "4.17.21");

        expect(result?.version).toBe("4.17.21");
        expect(result?.license).toBe("MIT");
    });

    it("should not use the hoisted copy when its version differs from the requested one", () => {
        expect.assertions(1);

        // Hoisted is 4.17.21 — we ask for 4.17.20.
        writePackageJson(tmpDir, "node_modules/lodash", {
            license: "MIT",
            name: "lodash",
            version: "4.17.21",
        });

        expect(readInstalledPackageMetadata(tmpDir, "lodash", "4.17.20")).toBeUndefined();
    });

    it("should prefer the pnpm virtual store over a mismatching hoisted copy", () => {
        expect.assertions(1);

        // Hoisted is version 4.17.21, virtual store has 4.17.20. Requesting 4.17.20
        // must prefer the virtual store (exact match) even though the hoisted copy exists.
        writePackageJson(tmpDir, "node_modules/lodash", {
            license: "ISC",
            name: "lodash",
            version: "4.17.21",
        });

        writePackageJson(tmpDir, "node_modules/.pnpm/lodash@4.17.20/node_modules/lodash", {
            license: "MIT",
            name: "lodash",
            version: "4.17.20",
        });

        expect(readInstalledPackageMetadata(tmpDir, "lodash", "4.17.20")?.license).toBe("MIT");
    });

    it("should return undefined when neither store has the package", () => {
        expect.assertions(1);

        expect(readInstalledPackageMetadata(tmpDir, "ghost", "1.0.0")).toBeUndefined();
    });

    it("should return undefined when node_modules doesn't exist at all", () => {
        expect.assertions(1);

        // `tmpDir` is empty — no node_modules created.
        expect(readInstalledPackageMetadata(tmpDir, "whatever", "1.0.0")).toBeUndefined();
    });

    it("should refuse to resolve names containing path-traversal sequences", () => {
        expect.assertions(3);

        // A sibling file the traversal would otherwise read.
        writeFileSync(join(tmpDir, "secret.json"), JSON.stringify({ leaked: true }));

        expect(readInstalledPackageMetadata(tmpDir, "..", "1.0.0")).toBeUndefined();
        expect(readInstalledPackageMetadata(tmpDir, "foo/..", "1.0.0")).toBeUndefined();
        expect(readInstalledPackageMetadata(tmpDir, "lodash", "../../../etc/passwd")).toBeUndefined();
    });

    it("should refuse names with multiple slashes or embedded nulls", () => {
        expect.assertions(2);

        expect(readInstalledPackageMetadata(tmpDir, "a/b/c", "1.0.0")).toBeUndefined();
        expect(readInstalledPackageMetadata(tmpDir, "foo\0bar", "1.0.0")).toBeUndefined();
    });

    it("should refuse names and versions containing Windows-style backslashes", () => {
        expect.assertions(3);

        // `join` on Windows treats `\` as a separator, so a value like
        // `foo\..\..\etc` would escape workspaceRoot even though it has no
        // forward slashes or literal `..` segments apart from the escaped ones.
        expect(readInstalledPackageMetadata(tmpDir, String.raw`foo\bar`, "1.0.0")).toBeUndefined();
        expect(readInstalledPackageMetadata(tmpDir, "lodash", String.raw`1.0.0\..\..\etc`)).toBeUndefined();
        expect(readInstalledPackageMetadata(tmpDir, String.raw`foo\..\..\etc`, "1.0.0")).toBeUndefined();
    });

    it("should find pnpm peer-disambiguated install dirs (foo@1.0.0_react@18.0.0)", () => {
        expect.assertions(2);

        // Only the peer-suffixed dir exists — the un-suffixed path is absent,
        // forcing the slow-path `.pnpm` scan.
        writePackageJson(tmpDir, "node_modules/.pnpm/some-plugin@1.0.0_react@18.0.0/node_modules/some-plugin", {
            license: "BSD-3-Clause",
            name: "some-plugin",
            version: "1.0.0",
        });

        const result = readInstalledPackageMetadata(tmpDir, "some-plugin", "1.0.0");

        expect(result?.version).toBe("1.0.0");
        expect(result?.license).toBe("BSD-3-Clause");
    });
});
