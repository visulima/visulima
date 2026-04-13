import { describe, expect, it } from "vitest";

import { parseNpmLockfile, parsePnpmLockfile, parseYarnLockfile, sriToHexDigest } from "../../src/sbom/lockfile";

describe(sriToHexDigest, () => {
    it("should decode a valid sha512 SRI string to hex", () => {
        expect.assertions(2);

        // "hello" base64 = aGVsbG8=
        const result = sriToHexDigest("sha512-aGVsbG8=");

        expect(result?.alg).toBe("SHA-512");
        expect(result?.content).toBe("68656c6c6f");
    });

    it("should return undefined for unsupported algorithms", () => {
        expect.assertions(1);

        expect(sriToHexDigest("md5-aGVsbG8=")).toBeUndefined();
    });

    it("should return undefined for malformed SRI strings", () => {
        expect.assertions(2);

        expect(sriToHexDigest("sha512")).toBeUndefined();
        expect(sriToHexDigest("")).toBeUndefined();
    });
});

describe(parseNpmLockfile, () => {
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

        const result = parseNpmLockfile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
        expect(result[0]?.hash).toEqual({ alg: "SHA-512", content: "68656c6c6f" });
    });

    it("should return an empty list for invalid JSON", () => {
        expect.assertions(1);

        expect(parseNpmLockfile("not json")).toEqual([]);
    });
});

describe(parsePnpmLockfile, () => {
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

        const result = parsePnpmLockfile(content);

        expect(result).toHaveLength(2);
        expect(result.map((p) => p.name).sort()).toEqual(["@visulima/path", "lodash"]);
    });

    it("should skip workspace and link references", () => {
        expect.assertions(1);

        const content = `packages:

  lodash@link:../lodash:
    resolution: {directory: ../lodash, type: directory}
`;

        expect(parsePnpmLockfile(content)).toEqual([]);
    });
});

describe(parseYarnLockfile, () => {
    it("should extract name/version/integrity from a yarn classic lockfile", () => {
        expect.assertions(3);

        const content = `
"lodash@^4.17.21":
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
  integrity "sha512-aGVsbG8="
`;

        const result = parseYarnLockfile(content);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: "lodash", version: "4.17.21" });
        expect(result[0]?.hash).toEqual({ alg: "SHA-512", content: "68656c6c6f" });
    });
});
