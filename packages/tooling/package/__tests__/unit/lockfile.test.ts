import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ensureDirSync, readFileSync, removeSync, writeFileSync } from "@visulima/fs";
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

const NO_LOCKFILE_ERROR = /Could not find a supported lock file/;

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

    it("should reject payloads containing characters outside the base64 alphabet", () => {
        expect.assertions(3);

        // `Buffer.from("…", "base64")` silently drops characters outside
        // [A-Za-z0-9+/=], so a garbage payload like `sha512-abc!def` would
        // decode to the bytes of "abcdef". Validate strictly up front.
        expect(decodeSriIntegrity("sha512-abc!def")).toBeUndefined();
        expect(decodeSriIntegrity("sha512-aGVsb G8=")).toBeUndefined(); // embedded space
        // URL-safe base64 is *not* the SRI alphabet — `-` and `_` would
        // normally map to `+` and `/`, but SRI mandates the standard alphabet.
        expect(decodeSriIntegrity("sha512-aGVsbG8_")).toBeUndefined();
    });

    it("should return undefined when the base64 payload decodes to an empty buffer", () => {
        expect.assertions(1);

        // A single base64 character carries only 6 bits — too few for one byte —
        // so it passes the strict alphabet regex yet decodes to zero bytes. Guard
        // against producing a hash with an empty digest.
        expect(decodeSriIntegrity("sha512-A")).toBeUndefined();
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
        expect(result[0]?.integrity).toStrictEqual({ algorithm: "sha512", hex: "68656c6c6f" });
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

        expect(foo?.dependencies).toStrictEqual({ bar: ["^1.0.0"] });
        expect(foo?.peerDependencies).toStrictEqual({ react: ["^18"] });
        expect(foo?.optionalDependencies).toStrictEqual({ fsevents: ["^2"] });
    });

    it("should return an empty list for invalid JSON", () => {
        expect.assertions(1);

        expect(parseNpmLockFile("not json")).toStrictEqual([]);
    });

    it("should return an empty list when the lockfile has no packages map", () => {
        expect.assertions(1);

        expect(parseNpmLockFile(JSON.stringify({ lockfileVersion: 3 }))).toStrictEqual([]);
    });

    it("should skip paths that are not node_modules entries and names starting with a dot", () => {
        expect.assertions(1);

        const content = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                // Non-node_modules path — the path regex doesn't match.
                "config/foo": { version: "1.0.0" },
                // node_modules path whose resolved name begins with `.` — skipped.
                "node_modules/.cache": { name: ".cache", version: "1.0.0" },
            },
        });

        expect(parseNpmLockFile(content)).toStrictEqual([]);
    });

    it("should deduplicate identical name@version entries", () => {
        expect.assertions(1);

        // Two paths resolve to the same `foo@1.0.0` — only one entry survives.
        const content = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "node_modules/bar/node_modules/foo": { version: "1.0.0" },
                "node_modules/foo": { version: "1.0.0" },
            },
        });

        expect(parseNpmLockFile(content).filter((entry) => entry.name === "foo")).toHaveLength(1);
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
        expect(result.map((entry) => entry.name).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["@visulima/path", "lodash"]);
    });

    it("should skip workspace and link references", () => {
        expect.assertions(1);

        const content = `packages:

  lodash@link:../lodash:
    resolution: {directory: ../lodash, type: directory}
`;

        expect(parsePnpmLockFile(content)).toStrictEqual([]);
    });

    it("should parse the vendored lockparse pnpm-lock.yaml fixture", () => {
        expect.assertions(1);

        expect(parsePnpmLockFile(readFixture("pnpm-lock.yaml")).length).toBeGreaterThan(0);
    });

    it("should capture dependency edges from pnpm v9 snapshots: section (not packages:)", () => {
        expect.assertions(2);

        // v9 moves concrete deps out of `packages:` and into `snapshots:`.
        // Our parser used to only read `packages:`, emitting every v9 entry
        // with an empty deps map. Verify the snapshot edges now flow
        // through, with peer suffixes stripped from both key and values.
        const content = `lockfileVersion: '9.0'

packages:

  '@ai-sdk/anthropic@3.0.68':
    resolution: {integrity: sha512-aGVsbG8=}
    peerDependencies:
      zod: ^3.25.76 || ^4.1.8

  '@ai-sdk/provider-utils@4.0.23':
    resolution: {integrity: sha512-aGVsbG8=}
    peerDependencies:
      zod: ^3.25.76 || ^4.1.8

snapshots:

  '@ai-sdk/anthropic@3.0.68(zod@4.3.6)':
    dependencies:
      '@ai-sdk/provider-utils': 4.0.23(zod@4.3.6)
      zod: 4.3.6

  '@ai-sdk/provider-utils@4.0.23(zod@4.3.6)':
    dependencies:
      zod: 4.3.6
`;

        const anthropic = parsePnpmLockFile(content).find((entry) => entry.name === "@ai-sdk/anthropic");

        expect(anthropic?.integrity?.algorithm).toBe("sha512");
        // Peer suffixes dropped from both the snapshot key and the dep values;
        // each value is wrapped in an array so multi-variant resolutions can
        // coexist (this entry has only one variant, so arrays are singletons).
        expect(anthropic?.dependencies).toStrictEqual({
            "@ai-sdk/provider-utils": ["4.0.23"],
            zod: ["4.3.6"],
        });
    });

    it("should preserve conflicting resolutions across peer-context variants", () => {
        expect.assertions(1);

        // Two snapshot variants resolve `react` to different versions. The
        // array-valued dep map keeps BOTH so the SBOM graph can emit both
        // edges — a spread-merge would have clobbered one.
        const content = `packages:

  react-dom@18.2.0:
    resolution: {integrity: sha512-aGVsbG8=}

snapshots:

  react-dom@18.2.0(react@18.0.0):
    dependencies:
      loose-envify: 1.4.0
      react: 18.0.0
      scheduler: 0.23.0

  react-dom@18.2.0(react@17.0.2):
    dependencies:
      loose-envify: 1.4.0
      react: 17.0.2
`;

        const reactDom = parsePnpmLockFile(content).find((entry) => entry.name === "react-dom");

        expect(reactDom?.dependencies).toStrictEqual({
            "loose-envify": ["1.4.0"],
            // Both peer-variant `react` resolutions preserved, insertion order.
            react: ["18.0.0", "17.0.2"],
            scheduler: ["0.23.0"],
        });
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
        expect(foo?.dependencies).toStrictEqual({ "@scope/baz": ["1.0.0"], bar: ["2.0.0"] });
        expect(foo?.peerDependencies).toStrictEqual({ react: [">=17"] });
    });

    it("should return an empty list when there is no packages section", () => {
        expect.assertions(1);

        // No `packages:` header at all (only metadata) — nothing to parse.
        expect(parsePnpmLockFile("lockfileVersion: '9.0'\n")).toStrictEqual([]);
    });

    it("should strip a leading slash from legacy v5 package keys", () => {
        expect.assertions(2);

        // pnpm v5 lockfiles prefix keys with `/`.
        const content = `packages:

  /lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}
`;

        const result = parsePnpmLockFile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
    });

    it("should skip package keys that have no version separator", () => {
        expect.assertions(1);

        // A key without an `@` separator can't be split into name/version.
        const content = `packages:

  lodash:
    resolution: {integrity: sha512-aGVsbG8=}
`;

        expect(parsePnpmLockFile(content)).toStrictEqual([]);
    });

    it("should skip workspace and file references in package keys", () => {
        expect.assertions(1);

        const content = `packages:

  pkg-a@workspace:packages/pkg-a:
    resolution: {directory: packages/pkg-a, type: directory}

  pkg-b@file:../pkg-b:
    resolution: {directory: ../pkg-b, type: directory}
`;

        expect(parsePnpmLockFile(content)).toStrictEqual([]);
    });

    it("should skip package keys whose version is empty", () => {
        expect.assertions(1);

        // `foo@` has an `@` separator but no version after it.
        const content = `packages:

  foo@:
    resolution: {integrity: sha512-aGVsbG8=}
`;

        expect(parsePnpmLockFile(content)).toStrictEqual([]);
    });

    it("should ignore snapshot keys that cannot be split into name and version", () => {
        expect.assertions(1);

        // The `broken-no-version:` snapshot key has no `@`, so it's skipped
        // while the valid package entry still parses with no extra edges.
        const content = `packages:

  foo@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}

snapshots:

  broken-no-version:
    dependencies:
      bar: 2.0.0

  foo@1.0.0:
    dependencies:
      bar: 2.0.0
`;

        const foo = parsePnpmLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toStrictEqual({ bar: ["2.0.0"] });
    });

    it("should skip dependency lines whose version resolves to empty", () => {
        expect.assertions(1);

        // The `empty:` dependency's quoted value collapses to an empty string
        // once the surrounding quotes are stripped, so it's dropped while the
        // real dep survives.
        const content = `packages:

  foo@1.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
    dependencies:
      bar: 2.0.0
      empty: ""
`;

        const foo = parsePnpmLockFile(content).find((entry) => entry.name === "foo");

        expect(foo?.dependencies).toStrictEqual({ bar: ["2.0.0"] });
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
        expect(result[0]?.integrity).toStrictEqual({ algorithm: "sha512", hex: "68656c6c6f" });
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

        expect(foo?.dependencies).toStrictEqual({ "@scope/baz": ["^1.0.0"], bar: ["^2.0.0"] });
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

        expect(foo?.dependencies).toStrictEqual({ "@scope/baz": ["npm:^1.0.0"], bar: ["npm:^2.0.0"] });
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

    it("should skip blocks that have no version line", () => {
        expect.assertions(1);

        // The first block has a body but no `version:` line — it must be
        // skipped while the well-formed block still resolves.
        const content = `
"broken@^1.0.0":
  resolved "https://registry.yarnpkg.com/broken/-/broken-1.0.0.tgz"

"foo@^1.0.0":
  version "1.0.0"
`;

        const result = parseYarnLockFile(content);

        expect(result).toStrictEqual([{ name: "foo", version: "1.0.0" }]);
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
        expect(result[0]?.integrity).toStrictEqual({ algorithm: "sha512", hex: "68656c6c6f" });
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

        expect(parseBunLockFile(content)).toStrictEqual([]);
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

        expect(foo?.dependencies).toStrictEqual({ bar: ["^2.0.0"] });
        expect(foo?.peerDependencies).toStrictEqual({ react: ["^18"] });
    });

    it("should return an empty list for invalid JSON", () => {
        expect.assertions(1);

        expect(parseBunLockFile("{invalidJson: true")).toStrictEqual([]);
    });

    it("should return an empty list when there is no packages map", () => {
        expect.assertions(1);

        expect(parseBunLockFile(`{ "lockfileVersion": 1, "workspaces": { "": { "name": "root" } } }`)).toStrictEqual([]);
    });

    it("should skip tuples whose first element is not a string or lacks a version separator", () => {
        expect.assertions(1);

        const content = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": {
    "not-a-string": [123, "", {}, "sha512-aGVsbG8="],
    "no-separator": ["plainname", "", {}, "sha512-aGVsbG8="]
  }
}`;

        expect(parseBunLockFile(content)).toStrictEqual([]);
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

    it("should return an empty list for an unknown lockfile type", () => {
        expect.assertions(1);

        // The default switch branch guards against a future / unexpected type.
        expect(parseLockFileContent("whatever", "unknown" as never)).toStrictEqual([]);
    });
});

describe("parseLockFile / parseLockFileSync", () => {
    let temporaryDirectory: string;

    beforeEach(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "visulima-package-"));
    });

    afterEach(() => {
        removeSync(temporaryDirectory);
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

    it("should find and parse an npm-shrinkwrap.json as the npm type", async () => {
        expect.assertions(2);

        writeFileSync(
            join(temporaryDirectory, "npm-shrinkwrap.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/a": { version: "1.0.0" } },
            }),
        );

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("npm");
        expect(result.entries[0]?.name).toBe("a");
    });

    it("should prefer pnpm-lock.yaml over a stale yarn.lock in the same directory", async () => {
        expect.assertions(2);

        writeFileSync(join(temporaryDirectory, "yarn.lock"), `"lodash@^4.17.21":\n  version "4.17.21"\n`);
        writeFileSync(
            join(temporaryDirectory, "pnpm-lock.yaml"),
            `packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}
`,
        );

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("pnpm");
        expect(result.path.endsWith("pnpm-lock.yaml")).toBe(true);
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

    it("should find legacy bun.lockb and infer the bun type (binary content yields no entries)", async () => {
        expect.assertions(2);

        // The legacy binary lockfile cannot be regex/JSON-parsed; we still
        // recognise it as a bun project but surface zero entries.
        writeFileSync(join(temporaryDirectory, "bun.lockb"), Buffer.from([0, 1, 2, 3, 4]));

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("bun");
        expect(result.entries).toHaveLength(0);
    });

    it("should prefer the modern bun.lock over a stale legacy bun.lockb", () => {
        expect.assertions(3);

        writeFileSync(join(temporaryDirectory, "bun.lockb"), Buffer.from([0, 1, 2, 3, 4]));
        writeFileSync(
            join(temporaryDirectory, "bun.lock"),
            `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "root" } },
  "packages": { "a": ["a@1.0.0", "", {}, "sha512-aGVsbG8="] },
}`,
        );

        const result = parseLockFileSync(temporaryDirectory);

        expect(result.type).toBe("bun");
        expect(result.path.endsWith("bun.lock")).toBe(true);
        expect(result.entries).toHaveLength(1);
    });

    it("should find and parse the nearest yarn.lock", async () => {
        expect.assertions(2);

        writeFileSync(
            join(temporaryDirectory, "yarn.lock"),
            `"lodash@^4.17.21":
  version "4.17.21"
`,
        );

        const result = await parseLockFile(temporaryDirectory);

        expect(result.type).toBe("yarn");
        expect(result.entries[0]?.name).toBe("lodash");
    });

    it("should throw when no supported lock file exists", async () => {
        expect.assertions(1);

        const isolated = join(tmpdir(), `no-lockfile-${String(Date.now())}`);

        ensureDirSync(isolated);

        await expect(parseLockFile(isolated)).rejects.toThrow(NO_LOCKFILE_ERROR);
    });

    it("should throw synchronously when no supported lock file exists", () => {
        expect.assertions(1);

        const isolated = join(tmpdir(), `no-lockfile-sync-${String(Date.now())}`);

        ensureDirSync(isolated);

        expect(() => parseLockFileSync(isolated)).toThrow(NO_LOCKFILE_ERROR);
    });
});
