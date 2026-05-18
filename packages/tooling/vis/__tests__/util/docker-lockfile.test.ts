import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseSyml } from "@yarnpkg/parsers";
import { describe, expect, it } from "vitest";
import { parse as parseYaml, parseAllDocuments } from "yaml";

import type { FocusProject } from "../../src/util/docker-lockfile";
import { LockfilePruneError, pruneLockfile } from "../../src/util/docker-lockfile";

const closure = (...projects: FocusProject[]): FocusProject[] => [{ deps: undefined, name: undefined, relativeRoot: "" }, ...projects];

describe("pruneLockfile (pnpm)", () => {
    it("keeps the focused importer and drops unfocused workspace projects (v9)", () => {
        expect.assertions(4);

        const lockfile = `lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: ^5.5.0
        version: 5.5.0
  packages/a:
    dependencies:
      lodash:
        specifier: ^4.17.21
        version: 4.17.21
  packages/b:
    dependencies:
      chalk:
        specifier: ^5.3.0
        version: 5.3.0
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
  chalk@5.3.0:
    resolution: {integrity: sha512-fake}
  typescript@5.5.0:
    resolution: {integrity: sha512-fake}
snapshots:
  lodash@4.17.21: {}
  chalk@5.3.0: {}
  typescript@5.5.0: {}
`;

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "pnpm",
        });

        expect(result.status).toBe("pruned");

        const parsed = parseYaml(result.content!) as { importers: Record<string, unknown>; packages: Record<string, unknown> };

        expect(Object.keys(parsed.importers)).toStrictEqual([".", "packages/a"]);
        expect(Object.keys(parsed.packages)).toContain("lodash@4.17.21");
        expect(Object.keys(parsed.packages)).not.toContain("chalk@5.3.0");
    });

    it("walks transitive deps in the snapshots graph (v9)", () => {
        expect.assertions(2);

        const lockfile = `lockfileVersion: '9.0'
importers:
  packages/a:
    dependencies:
      foo:
        specifier: ^1.0.0
        version: 1.0.0
packages:
  foo@1.0.0:
    resolution: {integrity: sha512-fake}
  bar@2.0.0:
    resolution: {integrity: sha512-fake}
  unrelated@9.9.9:
    resolution: {integrity: sha512-fake}
snapshots:
  foo@1.0.0:
    dependencies:
      bar: 2.0.0
  bar@2.0.0: {}
  unrelated@9.9.9: {}
`;

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "pnpm",
        });

        const parsed = parseYaml(result.content!) as { packages: Record<string, unknown> };
        const packageKeys = Object.keys(parsed.packages);

        expect(packageKeys).toContain("bar@2.0.0");
        expect(packageKeys).not.toContain("unrelated@9.9.9");
    });

    it("handles v6 packages-with-deps (no separate snapshots block)", () => {
        expect.assertions(2);

        const lockfile = `lockfileVersion: '6.0'
importers:
  packages/a:
    dependencies:
      foo:
        specifier: ^1.0.0
        version: 1.0.0
packages:
  /foo@1.0.0:
    resolution: {integrity: sha512-fake}
    dependencies:
      bar: 2.0.0
  /bar@2.0.0:
    resolution: {integrity: sha512-fake}
  /unrelated@9.9.9:
    resolution: {integrity: sha512-fake}
`;

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "pnpm",
        });

        const parsed = parseYaml(result.content!) as { packages: Record<string, unknown> };
        const packageKeys = Object.keys(parsed.packages);

        expect(packageKeys).toContain("/bar@2.0.0");
        expect(packageKeys).not.toContain("/unrelated@9.9.9");
    });

    it("throws LockfilePruneError on parse failure", () => {
        expect.assertions(1);

        expect(() =>
            pruneLockfile({
                closure: closure(),
                lockfileContent: "this: is: not: valid: yaml: : :",
                packageManager: "pnpm",
            }),
        ).toThrow(LockfilePruneError);
    });
});

describe("pruneLockfile (npm)", () => {
    it("keeps focus closure paths and dependency entries", () => {
        expect.assertions(4);

        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            name: "monorepo",
            packages: {
                "": { name: "monorepo", workspaces: ["packages/*"] },
                "node_modules/@my/a": { link: true, resolved: "packages/a" },
                "node_modules/@my/b": { link: true, resolved: "packages/b" },
                "node_modules/chalk": { version: "5.3.0" },
                "node_modules/lodash": { version: "4.17.21" },
                "packages/a": {
                    dependencies: { lodash: "^4.17.21" },
                    name: "@my/a",
                    version: "1.0.0",
                },
                "packages/b": {
                    dependencies: { chalk: "^5.3.0" },
                    name: "@my/b",
                    version: "1.0.0",
                },
            },
        });

        const result = pruneLockfile({
            closure: closure({ deps: { lodash: "^4.17.21" }, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "npm",
        });

        expect(result.status).toBe("pruned");

        const parsed = JSON.parse(result.content!);

        expect(parsed.packages["packages/a"]).toBeDefined();
        expect(parsed.packages["packages/b"]).toBeUndefined();
        expect(parsed.packages["node_modules/lodash"]).toBeDefined();
    });

    it("resolves nested node_modules deps before falling back to top-level", () => {
        expect.assertions(2);

        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { workspaces: ["packages/*"] },
                "node_modules/lodash": { version: "4.0.0" },
                "packages/a": { dependencies: { lodash: "^4.17.21" }, name: "@my/a" },
                "packages/a/node_modules/lodash": { version: "4.17.21" },
            },
        });

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "npm",
        });

        const parsed = JSON.parse(result.content!);

        expect(parsed.packages["packages/a/node_modules/lodash"]).toBeDefined();
        // Top-level lodash isn't pulled in — the nested one wins for packages/a.
        expect(parsed.packages["node_modules/lodash"]).toBeUndefined();
    });

    it("trims root workspaces array to closure-relevant entries", () => {
        expect.assertions(2);

        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { workspaces: ["packages/*", "tools/*"] },
                "packages/a": { name: "@my/a" },
                "tools/cli": { name: "@my/cli" },
            },
        });

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "npm",
        });

        const parsed = JSON.parse(result.content!);

        expect(parsed.packages[""].workspaces).toContain("packages/*");
        expect(parsed.packages[""].workspaces).not.toContain("tools/*");
    });
});

describe("pruneLockfile (yarn)", () => {
    it("prunes berry lockfiles using @workspace: resolutions", () => {
        expect.assertions(3);

        const lockfile = `__metadata:
  version: 6
  cacheKey: 8

"@my/a@workspace:packages/a":
  version: 0.0.0-use.local
  resolution: "@my/a@workspace:packages/a"
  dependencies:
    lodash: ^4.17.21
  languageName: unknown
  linkType: soft

"@my/b@workspace:packages/b":
  version: 0.0.0-use.local
  resolution: "@my/b@workspace:packages/b"
  dependencies:
    chalk: ^5.3.0
  languageName: unknown
  linkType: soft

"lodash@npm:^4.17.21":
  version: 4.17.21
  resolution: "lodash@npm:4.17.21"
  languageName: node
  linkType: hard

"chalk@npm:^5.3.0":
  version: 5.3.0
  resolution: "chalk@npm:5.3.0"
  languageName: node
  linkType: hard
`;

        const result = pruneLockfile({
            closure: closure({ deps: { lodash: "^4.17.21" }, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "yarn",
        });

        expect(result.status).toBe("pruned");

        const parsed = parseSyml(result.content!) as Record<string, { resolution?: string }>;

        expect(parsed["lodash@npm:^4.17.21"]).toBeDefined();
        expect(parsed["chalk@npm:^5.3.0"]).toBeUndefined();
    });

    it("seeds yarn classic from per-project deps (no workspace entries)", () => {
        expect.assertions(2);

        const lockfile = `lodash@^4.17.21:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
  integrity sha512-fake

chalk@^5.3.0:
  version "5.3.0"
  resolved "https://registry.yarnpkg.com/chalk/-/chalk-5.3.0.tgz"
  integrity sha512-fake
`;

        const result = pruneLockfile({
            closure: closure({ deps: { lodash: "^4.17.21" }, name: "a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "yarn",
        });

        const parsed = parseSyml(result.content!) as Record<string, unknown>;

        expect(parsed["lodash@^4.17.21"]).toBeDefined();
        expect(parsed["chalk@^5.3.0"]).toBeUndefined();
    });

    it("walks transitive deps via dependencies blocks", () => {
        expect.assertions(2);

        const lockfile = `__metadata:
  version: 6

"@my/a@workspace:packages/a":
  version: 0.0.0-use.local
  resolution: "@my/a@workspace:packages/a"
  dependencies:
    foo: ^1.0.0
  linkType: soft

"foo@npm:^1.0.0":
  version: 1.0.0
  resolution: "foo@npm:1.0.0"
  dependencies:
    bar: ^2.0.0
  linkType: hard

"bar@npm:^2.0.0":
  version: 2.0.0
  resolution: "bar@npm:2.0.0"
  linkType: hard

"unrelated@npm:^9.0.0":
  version: 9.0.0
  resolution: "unrelated@npm:9.0.0"
  linkType: hard
`;

        const result = pruneLockfile({
            closure: closure({ deps: { foo: "^1.0.0" }, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "yarn",
        });

        const parsed = parseSyml(result.content!) as Record<string, unknown>;

        expect(parsed["bar@npm:^2.0.0"]).toBeDefined();
        expect(parsed["unrelated@npm:^9.0.0"]).toBeUndefined();
    });
});

describe("pruneLockfile (bun)", () => {
    it("returns skipped result for binary bun.lockb", () => {
        expect.assertions(3);

        const result = pruneLockfile({
            closure: closure(),
            lockfileContent: Buffer.from([0x00, 0x01, 0x02]),
            packageManager: "bun",
        });

        expect(result.status).toBe("skipped");
        expect(result.content).toBeUndefined();
        expect(result.message).toMatch(/--save-text-lockfile/);
    });

    it("strips JSONC comments and prunes packages by name", () => {
        expect.assertions(3);

        const lockfile = `{
  // Header comment from bun
  "lockfileVersion": 1,
  "workspaces": {
    "": { "name": "root" },
    "packages/a": { "name": "@my/a", "dependencies": { "lodash": "^4.17.21" } },
    "packages/b": { "name": "@my/b", "dependencies": { "chalk": "^5.3.0" } }
  },
  /* block comment */
  "packages": {
    "lodash": ["lodash@4.17.21", "https://registry.npmjs.org/", {}, "sha512-fake"],
    "chalk": ["chalk@5.3.0", "https://registry.npmjs.org/", {}, "sha512-fake"]
  }
}
`;

        const result = pruneLockfile({
            closure: closure({ deps: { lodash: "^4.17.21" }, name: "@my/a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "bun",
        });

        expect(result.status).toBe("pruned");

        const parsed = JSON.parse(result.content!) as { packages: Record<string, unknown>; workspaces: Record<string, unknown> };

        expect(Object.keys(parsed.packages)).toStrictEqual(["lodash"]);
        expect(Object.keys(parsed.workspaces).sort()).toStrictEqual(["", "packages/a"]);
    });
});

describe("pruneLockfile (aube)", () => {
    it("delegates to the pnpm pruner and re-tags the message with aube-lock.yaml", () => {
        expect.assertions(4);

        const lockfile = `lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: ^5.5.0
        version: 5.5.0
  packages/a:
    dependencies:
      lodash:
        specifier: ^4.17.21
        version: 4.17.21
  packages/b:
    dependencies:
      chalk:
        specifier: ^5.3.0
        version: 5.3.0
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
  chalk@5.3.0:
    resolution: {integrity: sha512-fake}
  typescript@5.5.0:
    resolution: {integrity: sha512-fake}
snapshots:
  lodash@4.17.21: {}
  chalk@5.3.0: {}
  typescript@5.5.0: {}
`;

        const result = pruneLockfile({
            closure: closure({ deps: undefined, name: "a", relativeRoot: "packages/a" }),
            lockfileContent: lockfile,
            packageManager: "aube",
        });

        expect(result.status).toBe("pruned");
        expect(result.message).toContain("aube-lock.yaml");
        expect(result.message).not.toContain("pnpm-lock.yaml");

        const parsed = parseYaml(result.content!) as { importers: Record<string, unknown> };

        expect(Object.keys(parsed.importers)).toStrictEqual([".", "packages/a"]);
    });
});

describe("pruneLockfile (dispatcher)", () => {
    it("throws on unsupported package manager", () => {
        expect.assertions(1);

        expect(() =>
            pruneLockfile({
                closure: closure(),
                lockfileContent: "",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                packageManager: "bogus" as any,
            }),
        ).toThrow(/unsupported|unknown|invalid/i);
    });
});

/**
 * Smoke test against the visulima monorepo's own pnpm-lock.yaml. Catches
 * regressions that the synthetic fixtures miss (large `snapshots` blocks,
 * unusual peer dep graphs, catalog importers, etc).
 *
 * Skipped when the lockfile isn't reachable (detached/sandboxed runs) or
 * when running under CI: parsing 2.3 MB of YAML twice is CPU-bound and
 * starves under v8 coverage with ~80 parallel test files. The synthetic
 * fixtures above cover the API contract for every package manager.
 */
const workspaceRoot = join(__dirname, "..", "..", "..", "..", "..");
const repoLockfile = join(workspaceRoot, "pnpm-lock.yaml");
const repoLockfileAvailable = existsSync(repoLockfile) && existsSync(join(workspaceRoot, "packages", "tooling", "vis", "package.json"));
const skipFixtureSuite = !repoLockfileAvailable || process.env.CI === "true";

describe.skipIf(skipFixtureSuite)("pruneLockfile (visulima monorepo fixture)", () => {
    it("prunes the workspace lockfile down to the @visulima/vis closure", { timeout: 30_000 }, () => {
        expect.assertions(5);

        const lockfileContent = readFileSync(repoLockfile, "utf8");
        const visPkg = JSON.parse(readFileSync(join(workspaceRoot, "packages", "tooling", "vis", "package.json"), "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            name: string;
            optionalDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        const deps: Record<string, string> = {};

        for (const block of [visPkg.dependencies, visPkg.devDependencies, visPkg.optionalDependencies, visPkg.peerDependencies]) {
            if (block) {
                Object.assign(deps, block);
            }
        }

        const result = pruneLockfile({
            closure: closure({ deps, name: visPkg.name, relativeRoot: "packages/tooling/vis" }),
            lockfileContent,
            packageManager: "pnpm",
        });

        expect(result.status).toBe("pruned");
        expect(result.content).toBeDefined();

        const parsed = parseYaml(result.content!) as { importers: Record<string, unknown>; packages?: Record<string, unknown> };
        // pnpm v11 writes a multi-document lockfile (a tiny `@pnpm/exe` self-bootstrap
        // doc + the real workspace lockfile); pick the document with the most importers.
        const originalDocuments = parseAllDocuments(lockfileContent).map((document) => document.toJS() as { importers?: Record<string, unknown> });
        let original: { importers: Record<string, unknown>; packages?: Record<string, unknown> } = { importers: {} };

        for (const lockDocument of originalDocuments) {
            if (Object.keys(lockDocument.importers ?? {}).length > Object.keys(original.importers).length) {
                original = lockDocument as { importers: Record<string, unknown>; packages?: Record<string, unknown> };
            }
        }

        // Workspace root + the vis importer must survive.
        expect(parsed.importers["."]).toBeDefined();
        expect(parsed.importers["packages/tooling/vis"]).toBeDefined();

        // Pruning must drop *something* — the vis closure is a small slice
        // of a 194-importer graph, so we expect a meaningful reduction.
        const originalImporters = Object.keys(original.importers).length;
        const prunedImporters = Object.keys(parsed.importers).length;

        expect(prunedImporters).toBeLessThan(originalImporters);
    });
});
