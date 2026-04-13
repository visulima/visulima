import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    decodeSriIntegrity,
    parseLockFile,
    parseLockFileContent,
    parseLockFileSync,
    parseNpmLockFile,
    parsePnpmLockFile,
    parseYarnLockFile,
} from "../../src/lockfile";

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

    it("should throw when no supported lock file exists", async () => {
        expect.assertions(1);

        // An empty dir in /tmp has no lockfile above it (fresh mkdtemp).
        const isolated = join(tmpdir(), `no-lockfile-${Date.now()}`);

        mkdirSync(isolated, { recursive: true });

        await expect(parseLockFile(isolated)).rejects.toThrow(/Could not find a supported lock file/);
    });
});
