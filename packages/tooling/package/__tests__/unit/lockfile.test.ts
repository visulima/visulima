import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    decodeSriIntegrity,
    parseBunLockFile,
    parseLockFile,
    parseLockFileContent,
    parseLockFileSync,
    parseNpmLockFile,
    parsePnpmLockFile,
    parseYarnLockFile,
} from "../../src/lockfile";

/**
 * Lockfile fixtures are vendored from lockparse
 * (https://github.com/43081j/lockparse, MIT) so our parsers are
 * exercised against real-world npm/pnpm/yarn/bun output.
 */
const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "lockfiles");
const readFixture = (name: string): string => readFileSync(join(fixtureDirectory, name), "utf8");

describe(decodeSriIntegrity, () => {
    it("should decode a valid sha512 SRI string to hex", () => {
        expect.assertions(2);

        // "hello" base64 = aGVsbG8=
        const result = decodeSriIntegrity("sha512-aGVsbG8=");

        expect(result?.algorithm).toBe("sha512");
        expect(result?.hex).toBe("68656c6c6f");
    });

    it("should return undefined for unsupported algorithms", () => {
        expect.assertions(1);

        expect(decodeSriIntegrity("md5-aGVsbG8=")).toBeUndefined();
    });

    it("should return undefined for malformed SRI strings", () => {
        expect.assertions(2);

        expect(decodeSriIntegrity("sha512")).toBeUndefined();
        expect(decodeSriIntegrity("")).toBeUndefined();
    });

    it("should reject oversized SRI strings without allocating a huge buffer", () => {
        expect.assertions(1);

        // A malicious lockfile might stash megabytes of base64 here hoping we
        // call Buffer.from on it. We cap at 1 KiB; anything above that is
        // refused before the decode step.
        const hostile = `sha512-${"A".repeat(10 * 1024)}`;

        expect(decodeSriIntegrity(hostile)).toBeUndefined();
    });
});

describe(parseNpmLockFile, () => {
    it("should extract name/version/integrity from an npm v3 lockfile", () => {
        expect.assertions(3);

        const content = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { name: "root", version: "1.0.0" },
                "node_modules/lodash": {
                    integrity: "sha512-aGVsbG8=",
                    version: "4.17.21",
                },
            },
        });

        const result = parseNpmLockFile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
        expect(result[0]?.integrity).toEqual({ algorithm: "sha512", hex: "68656c6c6f" });
    });

    it("should keep distinct name@version pairs (hoisted + nested deduped copies collapse)", () => {
        expect.assertions(3);

        const content = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { name: "root", version: "1.0.0" },
                // Two different versions of `foo` — should both appear.
                "node_modules/bar/node_modules/foo": { version: "2.0.0" },
                "node_modules/foo": { version: "1.0.0" },
            },
        });

        const entries = parseNpmLockFile(content).filter((entry) => entry.name === "foo");

        expect(entries).toHaveLength(2);
        expect(entries.some((entry) => entry.version === "1.0.0")).toBe(true);
        expect(entries.some((entry) => entry.version === "2.0.0")).toBe(true);
    });

    it("should parse the vendored lockparse package-lock.json fixture", () => {
        expect.assertions(2);

        const entries = parseNpmLockFile(readFixture("package-lock.json"));

        expect(entries.length).toBeGreaterThan(0);

        // Every entry should have an SRI-decoded integrity digest.
        expect(entries.every((entry) => entry.integrity?.algorithm !== undefined)).toBe(true);
    });

    it("should capture per-entry dependencies / peerDependencies / optionalDependencies", () => {
        expect.assertions(3);

        const content = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { name: "root", version: "1.0.0" },
                "node_modules/foo": {
                    dependencies: { bar: "^1.0.0" },
                    optionalDependencies: { fsevents: "^2" },
                    peerDependencies: { react: "^18" },
                    version: "1.2.3",
                },
            },
        });

        const foo = parseNpmLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toEqual({ bar: "^1.0.0" });
        expect(foo?.peerDependencies).toEqual({ react: "^18" });
        expect(foo?.optionalDependencies).toEqual({ fsevents: "^2" });
    });

    it("should return an empty list for invalid JSON", () => {
        expect.assertions(1);

        expect(parseNpmLockFile("not json")).toEqual([]);
    });
});

describe(parsePnpmLockFile, () => {
    it("should extract name/version/integrity from pnpm lockfile v9", () => {
        expect.assertions(2);

        const content = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}

  '@visulima/path@1.0.0':
    resolution: {integrity: sha512-aGVsbG8=}
`;

        const result = parsePnpmLockFile(content);

        expect(result).toHaveLength(2);
        expect(result.map((entry) => entry.name).sort()).toEqual(["@visulima/path", "lodash"]);
    });

    it("should skip workspace and link references", () => {
        expect.assertions(1);

        const content = `packages:

  lodash@link:../lodash:
    resolution: {directory: ../lodash, type: directory}
`;

        expect(parsePnpmLockFile(content)).toEqual([]);
    });

    it("should parse the vendored lockparse pnpm-lock.yaml fixture", () => {
        expect.assertions(1);

        expect(parsePnpmLockFile(readFixture("pnpm-lock.yaml")).length).toBeGreaterThan(0);
    });

    it("should capture per-entry dependency sub-maps and strip peer disambiguators", () => {
        expect.assertions(2);

        const content = `packages:

  foo@1.2.3:
    resolution: {integrity: sha512-aGVsbG8=}
    dependencies:
      bar: 2.0.0
      '@scope/baz': 1.0.0(react@18.0.0)
    peerDependencies:
      react: '>=17'
`;

        const foo = parsePnpmLockFile(content).find((entry) => entry.name === "foo");

        // Peer disambiguator `(react@18.0.0)` stripped from the resolved version.
        expect(foo?.dependencies).toEqual({ "@scope/baz": "1.0.0", bar: "2.0.0" });
        expect(foo?.peerDependencies).toEqual({ react: ">=17" });
    });
});

describe(parseYarnLockFile, () => {
    it("should extract name/version/integrity from a yarn classic lockfile", () => {
        expect.assertions(3);

        const content = `
"lodash@^4.17.21":
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
  integrity "sha512-aGVsbG8="
`;

        const result = parseYarnLockFile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
        expect(result[0]?.integrity).toEqual({ algorithm: "sha512", hex: "68656c6c6f" });
    });

    it("should parse the vendored lockparse yarn.lock (Berry) fixture", () => {
        expect.assertions(1);

        expect(parseYarnLockFile(readFixture("yarn.lock")).length).toBeGreaterThan(0);
    });

    it("should parse the vendored lockparse yarn-v1.lock fixture", () => {
        expect.assertions(1);

        expect(parseYarnLockFile(readFixture("yarn-v1.lock")).length).toBeGreaterThan(0);
    });

    it("should capture a yarn v1 entry's dependencies sub-map", () => {
        expect.assertions(1);

        const content = `
"foo@^1.0.0":
  version "1.2.3"
  resolved "https://registry.yarnpkg.com/foo/-/foo-1.2.3.tgz"
  integrity "sha512-aGVsbG8="
  dependencies:
    bar "^2.0.0"
    "@scope/baz" "^1.0.0"
`;

        const foo = parseYarnLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toEqual({ "@scope/baz": "^1.0.0", bar: "^2.0.0" });
    });

    it("should capture a yarn Berry entry's dependencies with colon-separated 'npm:' specifiers", () => {
        expect.assertions(1);

        const content = `
"foo@npm:1.2.3":
  version: 1.2.3
  resolution: "foo@npm:1.2.3"
  dependencies:
    bar: "npm:^2.0.0"
    "@scope/baz": "npm:^1.0.0"
  languageName: node
  linkType: hard
`;

        const foo = parseYarnLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toEqual({ "@scope/baz": "npm:^1.0.0", bar: "npm:^2.0.0" });
    });

    it("should leave Yarn Berry entries without integrity (XXH64 isn't supported)", () => {
        expect.assertions(2);

        // Berry only records `checksum: 10c0/…` (XXH64), not an SRI. Since
        // XXH64 isn't in CycloneDX's HashAlgorithm enum, the entry comes
        // out of the parser with `integrity: undefined` — this is the
        // documented behaviour; callers that need Berry integrity must
        // read yarn.lock directly.
        const content = `
"foo@npm:1.2.3":
  version: 1.2.3
  resolution: "foo@npm:1.2.3"
  checksum: 10c0/abc123def456
  languageName: node
  linkType: hard
`;

        const foo = parseYarnLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.version).toBe("1.2.3");
        expect(foo?.integrity).toBeUndefined();
    });
});

describe(parseBunLockFile, () => {
    it("should extract name/version/integrity from a bun.lock entry", () => {
        expect.assertions(3);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root", "dependencies": { "lodash": "^4.17.21" } } },
  "packages": {
    "lodash": ["lodash@4.17.21", "", {}, "sha512-aGVsbG8="],
  },
}`;

        const result = parseBunLockFile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
        expect(result[0]?.integrity).toEqual({ algorithm: "sha512", hex: "68656c6c6f" });
    });

    it("should tolerate trailing commas (Bun emits them)", () => {
        expect.assertions(1);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root", }, },
  "packages": {
    "a": ["a@1.0.0", "", {}, "sha512-aGVsbG8="],
  },
}`;

        expect(parseBunLockFile(content)).toHaveLength(1);
    });

    it("should skip workspace/link references", () => {
        expect.assertions(1);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": {
    "pkg-a": ["pkg-a@workspace:packages/pkg-a", "", {}],
  },
}`;

        expect(parseBunLockFile(content)).toEqual([]);
    });

    it("should parse the vendored lockparse bun.lock fixture", () => {
        expect.assertions(3);

        const entries = parseBunLockFile(readFixture("bun.lock"));

        // Fixture has 92 distinct `name@version` tuples; any change warrants a
        // deliberate test update rather than silent drift.
        expect(entries).toHaveLength(92);

        const eslint = entries.find((entry) => entry.name === "eslint");

        expect(eslint?.version).toBe("9.37.0");
        expect(eslint?.integrity?.algorithm).toBe("sha512");
    });

    it("should parse the vendored bun monorepo fixture and surface the workspace-external deps", () => {
        expect.assertions(2);

        const entries = parseBunLockFile(readFixture("bun-monorepo.lock"));

        expect(entries.length).toBeGreaterThan(0);
        // `pkg-a` / `pkg-b` are workspace entries — they must not land in the
        // registry-dep list (they use `workspace:` version specifiers).
        expect(entries.some((entry) => entry.name === "pkg-a" || entry.name === "pkg-b")).toBe(false);
    });

    it("should capture dependencies / peerDependencies from the tuple's metadata slot", () => {
        expect.assertions(2);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": {
    "foo": ["foo@1.2.3", "", { "dependencies": { "bar": "^2.0.0" }, "peerDependencies": { "react": "^18" } }, "sha512-aGVsbG8="],
  },
}`;

        const foo = parseBunLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toEqual({ bar: "^2.0.0" });
        expect(foo?.peerDependencies).toEqual({ react: "^18" });
    });

    it("should return an empty list for invalid JSON", () => {
        expect.assertions(1);

        expect(parseBunLockFile("{invalidJson: true")).toEqual([]);
    });
});

describe(parseLockFileContent, () => {
    it("should dispatch to the npm parser for type='npm'", () => {
        expect.assertions(1);

        const content = JSON.stringify({
            packages: { "node_modules/a": { version: "1.0.0" } },
        });

        expect(parseLockFileContent(content, "npm")).toHaveLength(1);
    });

    it("should dispatch to the pnpm parser for type='pnpm'", () => {
        expect.assertions(1);

        const content = `packages:

  a@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
`;

        expect(parseLockFileContent(content, "pnpm")).toHaveLength(1);
    });

    it("should dispatch to the yarn parser for type='yarn'", () => {
        expect.assertions(1);

        const content = `"a@^1.0.0":
  version "1.0.0"
`;

        expect(parseLockFileContent(content, "yarn")).toHaveLength(1);
    });

    it("should dispatch to the bun parser for type='bun'", () => {
        expect.assertions(1);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": {
    "a": ["a@1.0.0", "", {}, "sha512-aGVsbG8="],
  },
}`;

        expect(parseLockFileContent(content, "bun")).toHaveLength(1);
    });
});

describe("parseLockFile / parseLockFileSync", () => {
    let temporaryDirectory: string;

    beforeEach(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));
    });

    afterEach(() => {
        rmSync(temporaryDirectory, { force: true, recursive: true });
    });

    it("should find and parse the nearest pnpm-lock.yaml", async () => {
        expect.assertions(3);

        writeFileSync(
            join(temporaryDirectory, "pnpm-lock.yaml"),
            `packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("pnpm");
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]?.name).toBe("lodash");
    });

    it("should find and parse the nearest package-lock.json synchronously", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporaryDirectory, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/a": { version: "1.0.0" } },
            }),
        );

        const result = parseLockFileSync(temporaryDirectory);

        expect(result.type).toBe("npm");
        expect(result.entries[0]?.name).toBe("a");
    });

    it("should find and parse bun.lock", async () => {
        expect.assertions(2);

        writeFileSync(
            join(temporaryDirectory, "bun.lock"),
            `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": { "a": ["a@1.0.0", "", {}, "sha512-aGVsbG8="] },
}`,
        );

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("bun");
        expect(result.entries).toHaveLength(1);
    });

    it("should throw when no supported lock file exists", async () => {
        expect.assertions(1);

        const isolated = join(tmpdir(), `no-lockfile-${Date.now()}`);

        mkdirSync(isolated, { recursive: true });

        await expect(parseLockFile(isolated)).rejects.toThrow(/Could not find a supported lock file/);
    });
});
