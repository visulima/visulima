import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractPackageName, LockfileHasher, parseBunLockfile, parseNpmLockfile, parsePnpmLockfile, parseYarnLockfile } from "../../src/lockfile-hasher";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `lockfile-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(parseNpmLockfile, () => {
    it("should parse v2/v3 packages format", () => {
        expect.assertions(3);

        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { version: "1.0.0" },
                "node_modules/@types/node": { version: "20.10.0" },
                "node_modules/lodash": { version: "4.17.21" },
                "node_modules/typescript": { version: "5.3.2" },
            },
        });

        const versions = parseNpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
        expect(versions.get("typescript")).toBe("5.3.2");
    });

    it("should parse v1 dependencies format", () => {
        expect.assertions(2);

        const lockfile = JSON.stringify({
            dependencies: {
                express: { version: "4.18.2" },
                lodash: { version: "4.17.21" },
            },
            lockfileVersion: 1,
        });

        const versions = parseNpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("express")).toBe("4.18.2");
    });

    it("should prefer top-level packages for duplicates", () => {
        expect.assertions(1);

        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "node_modules/react": { version: "18.2.0" },
                "node_modules/some-pkg/node_modules/react": { version: "17.0.2" },
            },
        });

        const versions = parseNpmLockfile(lockfile);

        expect(versions.get("react")).toBe("18.2.0");
    });

    it("should return empty map for invalid JSON", () => {
        expect.assertions(1);

        const versions = parseNpmLockfile("not json");

        expect(versions.size).toBe(0);
    });
});

describe(parsePnpmLockfile, () => {
    it("should parse dependencies section with specifier+version", () => {
        expect.assertions(2);

        const lockfile = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
      express:
        specifier: ^4.18.0
        version: 4.18.2
`;

        const versions = parsePnpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("express")).toBe("4.18.2");
    });

    it("should parse packages section as fallback", () => {
        expect.assertions(2);

        const lockfile = `lockfileVersion: '6.0'

packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-abc}
  /@types/node@20.10.0:
    resolution: {integrity: sha512-def}
`;

        const versions = parsePnpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
    });
});

describe(parseYarnLockfile, () => {
    it("should parse Yarn v1 format", () => {
        expect.assertions(2);

        const lockfile = `# yarn lockfile v1

"lodash@^4.17.0":
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"

"@types/node@^20.0.0":
  version "20.10.0"
  resolved "https://registry.yarnpkg.com/@types/node/-/node-20.10.0.tgz"
`;

        const versions = parseYarnLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
    });

    it("should parse Yarn Berry format", () => {
        expect.assertions(2);

        const lockfile = `__metadata:
  version: 8

"lodash@npm:^4.17.0":
  version: 4.17.21
  resolution: "lodash@npm:4.17.21"

"@types/node@npm:^20.0.0":
  version: 20.10.0
  resolution: "@types/node@npm:20.10.0"
`;

        const versions = parseYarnLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
    });
});

describe(parseBunLockfile, () => {
    it("should parse bun.lock (text/JSONC) packages", () => {
        expect.assertions(2);

        const lockfile = `{
  // Bun lockfile
  "lockfileVersion": 1,
  "packages": {
    "lodash": ["lodash@4.17.21", "", {}, "sha512-abc"],
    "@types/node": ["@types/node@20.10.0", "", {}, "sha512-def"],
  },
}`;

        const versions = parseBunLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
    });

    it("should skip workspace/catalog protocol versions", () => {
        expect.assertions(2);

        const lockfile = `{
  "lockfileVersion": 1,
  "packages": {
    "internal-pkg": ["internal-pkg@workspace:packages/internal", "", {}, ""],
    "react": ["react@18.2.0", "", {}, "sha512-x"]
  }
}`;

        const versions = parseBunLockfile(lockfile);

        expect(versions.has("internal-pkg")).toBe(false);
        expect(versions.get("react")).toBe("18.2.0");
    });

    it("should return an empty map for invalid content", () => {
        expect.assertions(1);

        expect(parseBunLockfile("not json").size).toBe(0);
    });
});

describe(extractPackageName, () => {
    it("should extract simple package name", () => {
        expect.assertions(1);
        expect(extractPackageName("node_modules/lodash")).toBe("lodash");
    });

    it("should extract scoped package name", () => {
        expect.assertions(1);
        expect(extractPackageName("node_modules/@types/node")).toBe("@types/node");
    });

    it("should handle nested node_modules", () => {
        expect.assertions(1);
        expect(extractPackageName("node_modules/pkg-a/node_modules/lodash")).toBe("lodash");
    });

    it("should return null for empty path", () => {
        expect.assertions(1);
        expect(extractPackageName("")).toBeUndefined();
    });

    it("should return null for hidden entries", () => {
        expect.assertions(1);
        expect(extractPackageName("node_modules/.package-lock.json")).toBeUndefined();
    });

    it("should return null for paths without node_modules", () => {
        expect.assertions(1);
        expect(extractPackageName("src/index.ts")).toBeUndefined();
    });
});

describe(LockfileHasher, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should hash only relevant dependencies from npm lockfile", async () => {
        expect.assertions(5);

        // Create package.json for project
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                devDependencies: { typescript: "^5.0.0" },
                name: "app",
            }),
        );

        // Create npm lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/express": { version: "4.18.2" },
                    "node_modules/lodash": { version: "4.17.21" },
                    "node_modules/typescript": { version: "5.3.2" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).toBeDefined();
        expect((result as NonNullable<typeof result>).dependencies).toHaveLength(2);

        const depNames = (result as NonNullable<typeof result>).dependencies.map((d) => d.name);

        expect(depNames).toContain("lodash");
        expect(depNames).toContain("typescript");
        // express is NOT a dep of this package
        expect(depNames).not.toContain("express");
    });

    it("should produce different hashes for different resolved versions", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "app",
            }),
        );

        // First lockfile version
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        const hasher1 = new LockfileHasher(workspaceRoot);
        const result1 = await hasher1.hashForPackage("packages/app/package.json");

        // Update lockfile with different version
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.20" },
                },
            }),
        );

        const hasher2 = new LockfileHasher(workspaceRoot);
        const result2 = await hasher2.hashForPackage("packages/app/package.json");

        expect((result1 as NonNullable<typeof result1>).hash).not.toBe((result2 as NonNullable<typeof result2>).hash);
    });

    it("should return null when no lockfile exists", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "app",
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).toBeUndefined();
    });

    it("should return null when package.json has no dependencies", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/package.json"), JSON.stringify({ name: "app" }));

        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).toBeUndefined();
    });

    it("should detect lockfile type", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "app",
            }),
        );

        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);

        await hasher.hashForPackage("packages/app/package.json");

        expect(hasher.lockfileType).toBe("npm");
    });

    it("should cache lockfile parsing across calls", async () => {
        expect.assertions(5);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/lib"), { recursive: true });

        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "app",
            }),
        );

        await writeFile(
            join(workspaceRoot, "packages/lib/package.json"),
            JSON.stringify({
                dependencies: { express: "^4.18.0" },
                name: "lib",
            }),
        );

        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/express": { version: "4.18.2" },
                    "node_modules/lodash": { version: "4.17.21" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result1 = await hasher.hashForPackage("packages/app/package.json");
        const result2 = await hasher.hashForPackage("packages/lib/package.json");

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();

        // Different packages should have different hashes
        expect((result1 as NonNullable<typeof result1>).hash).not.toBe((result2 as NonNullable<typeof result2>).hash);

        // Verify correct dependencies
        expect((result1 as NonNullable<typeof result1>).dependencies[0]?.name).toBe("lodash");
        expect((result2 as NonNullable<typeof result2>).dependencies[0]?.name).toBe("express");
    });
});
