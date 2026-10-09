import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lintMissingPackageJson } from "../../src/deps/missing-package-json";

describe(lintMissingPackageJson, () => {
    let root: string;

    const touch = (path: string, content = ""): void => {
        mkdirSync(join(root, path, ".."), { recursive: true });
        writeFileSync(join(root, path), content);
    };

    const lint = (pattern: string): string[] => {
        writeFileSync(join(root, "pnpm-workspace.yaml"), `packages:\n  - '${pattern}'\n`);

        return lintMissingPackageJson(root)
            .map((issue) => issue.packageDir)
            .sort();
    };

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-missing-pkg-"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("reports a `packages/*` child without a package.json", () => {
        expect.assertions(1);

        touch("packages/foo/package.json", "{}");
        mkdirSync(join(root, "packages", "ghost"), { recursive: true });

        expect(lint("packages/*")).toStrictEqual(["packages/ghost"]);
    });

    it("never reports directories inside a package under `packages/**`", () => {
        expect.assertions(1);

        touch("packages/foo/package.json", "{}");
        touch("packages/foo/src/index.ts");
        touch("packages/foo/src/nested/deep.ts");
        touch("packages/foo/__tests__/foo.test.ts");
        touch("packages/foo/docs/readme.md");

        expect(lint("packages/**")).toStrictEqual([]);
    });

    it("reports only the topmost package-less directory under `packages/**`", () => {
        expect.assertions(1);

        touch("packages/group/pkg/package.json", "{}");
        touch("packages/group/pkg/src/index.ts");
        mkdirSync(join(root, "packages", "group", "stale", "sub"), { recursive: true });
        mkdirSync(join(root, "packages", "old", "node_modules"), { recursive: true });

        // `packages/group` holds a real package, so it is a grouping
        // directory rather than a stale one.
        expect(lint("packages/**")).toStrictEqual(["packages/group/stale", "packages/old"]);
    });

    it("skips source folders of nested packages under `packages/*/*`", () => {
        expect.assertions(1);

        touch("packages/scope/a/package.json", "{}");
        touch("packages/scope/a/src/index.ts");
        mkdirSync(join(root, "packages", "scope", "b"), { recursive: true });

        expect(lint("packages/*/*")).toStrictEqual(["packages/scope/b"]);
    });
});
