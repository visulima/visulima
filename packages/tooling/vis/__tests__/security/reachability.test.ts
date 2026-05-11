import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeReachableVulnerablePackages, extractImportedNames, normalizePackageName } from "../../src/security/reachability";

describe(normalizePackageName, () => {
    it("returns the bare package name", () => {
        expect.assertions(1);

        expect(normalizePackageName("lodash")).toBe("lodash");
    });

    it("strips subpath imports", () => {
        expect.assertions(1);

        expect(normalizePackageName("lodash/fp/get")).toBe("lodash");
    });

    it("preserves scoped package names", () => {
        expect.assertions(2);

        expect(normalizePackageName("@visulima/fs")).toBe("@visulima/fs");
        expect(normalizePackageName("@visulima/fs/glob")).toBe("@visulima/fs");
    });

    it("rejects relative and protocol specifiers", () => {
        expect.assertions(4);

        expect(normalizePackageName("./local")).toBeUndefined();
        expect(normalizePackageName("../local")).toBeUndefined();
        expect(normalizePackageName("node:fs")).toBeUndefined();
        expect(normalizePackageName("/abs/path")).toBeUndefined();
    });
});

describe(extractImportedNames, () => {
    it("catches ES imports", () => {
        expect.assertions(2);

        const names = extractImportedNames(`import { foo } from "lodash"; import "side-effect";`);

        expect(names.has("lodash")).toBe(true);
        expect(names.has("side-effect")).toBe(true);
    });

    it("catches CJS requires", () => {
        expect.assertions(1);

        const names = extractImportedNames(`const x = require("commander");`);

        expect(names.has("commander")).toBe(true);
    });

    it("catches dynamic imports with string literals", () => {
        expect.assertions(1);

        const names = extractImportedNames(`const mod = await import("zod");`);

        expect(names.has("zod")).toBe(true);
    });

    it("ignores imports inside comments", () => {
        expect.assertions(2);

        const names = extractImportedNames(`
// import { foo } from "in-line-comment";
/* import { bar } from "block-comment"; */
import { baz } from "real";
`);

        expect(names.has("in-line-comment")).toBe(false);
        expect(names.has("block-comment")).toBe(false);
    });
});

describe(computeReachableVulnerablePackages, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-reach-"));
        mkdirSync(join(workspace, "src"), { recursive: true });
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("returns vulnerable packages that are statically imported", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "src", "a.ts"), `import lodash from "lodash";`);
        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "x" }));

        const result = computeReachableVulnerablePackages({
            workspaceRoot: workspace,
            vulnerablePackages: new Set(["lodash", "axios"]),
        });

        expect([...result.reachable].sort()).toEqual(["lodash"]);
    });

    it("counts package.json-declared deps as reachable", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspace, "package.json"),
            JSON.stringify({ name: "x", dependencies: { lodash: "^4" } }),
        );

        const result = computeReachableVulnerablePackages({
            workspaceRoot: workspace,
            vulnerablePackages: new Set(["lodash"]),
        });

        expect(result.reachable.has("lodash")).toBe(true);
    });

    it("forces in alwaysAssumeUsed entries", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "x" }));

        const result = computeReachableVulnerablePackages({
            workspaceRoot: workspace,
            vulnerablePackages: new Set(["esbuild"]),
            alwaysAssumeUsed: ["esbuild"],
        });

        expect(result.reachable.has("esbuild")).toBe(true);
    });
});
