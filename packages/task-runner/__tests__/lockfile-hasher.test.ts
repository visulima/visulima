import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
    LockfileHasher,
    parseNpmLockfile,
    parsePnpmLockfile,
    parseYarnLockfile,
    extractPackageName,
} from "../src/lockfile-hasher";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `lockfile-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("parseNpmLockfile", () => {
    it("should parse v2/v3 packages format", () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                "": { version: "1.0.0" },
                "node_modules/lodash": { version: "4.17.21" },
                "node_modules/@types/node": { version: "20.10.0" },
                "node_modules/typescript": { version: "5.3.2" },
            },
        });

        const versions = parseNpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("@types/node")).toBe("20.10.0");
        expect(versions.get("typescript")).toBe("5.3.2");
    });

    it("should parse v1 dependencies format", () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 1,
            dependencies: {
                lodash: { version: "4.17.21" },
                express: { version: "4.18.2" },
            },
        });

        const versions = parseNpmLockfile(lockfile);

        expect(versions.get("lodash")).toBe("4.17.21");
        expect(versions.get("express")).toBe("4.18.2");
    });

    it("should prefer top-level packages for duplicates", () => {
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
        const versions = parseNpmLockfile("not json");

        expect(versions.size).toBe(0);
    });
});

describe("parsePnpmLockfile", () => {
    it("should parse dependencies section with specifier+version", () => {
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

describe("parseYarnLockfile", () => {
    it("should parse Yarn v1 format", () => {
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

describe("extractPackageName", () => {
    it("should extract simple package name", () => {
        expect(extractPackageName("node_modules/lodash")).toBe("lodash");
    });

    it("should extract scoped package name", () => {
        expect(extractPackageName("node_modules/@types/node")).toBe("@types/node");
    });

    it("should handle nested node_modules", () => {
        expect(extractPackageName("node_modules/pkg-a/node_modules/lodash")).toBe("lodash");
    });

    it("should return null for empty path", () => {
        expect(extractPackageName("")).toBeNull();
    });

    it("should return null for hidden entries", () => {
        expect(extractPackageName("node_modules/.package-lock.json")).toBeNull();
    });

    it("should return null for paths without node_modules", () => {
        expect(extractPackageName("src/index.ts")).toBeNull();
    });
});

describe("LockfileHasher", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should hash only relevant dependencies from npm lockfile", async () => {
        // Create package.json for project
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { lodash: "^4.17.0" },
                devDependencies: { typescript: "^5.0.0" },
            }),
        );

        // Create npm lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                    "node_modules/typescript": { version: "5.3.2" },
                    "node_modules/express": { version: "4.18.2" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).not.toBeNull();
        expect(result!.dependencies).toHaveLength(2);

        const depNames = result!.dependencies.map((d) => d.name);

        expect(depNames).toContain("lodash");
        expect(depNames).toContain("typescript");
        // express is NOT a dep of this package
        expect(depNames).not.toContain("express");
    });

    it("should produce different hashes for different resolved versions", async () => {
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { lodash: "^4.17.0" },
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

        expect(result1!.hash).not.toBe(result2!.hash);
    });

    it("should return null when no lockfile exists", async () => {
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { lodash: "^4.17.0" },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).toBeNull();
    });

    it("should return null when package.json has no dependencies", async () => {
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({ name: "app" }),
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
        const result = await hasher.hashForPackage("packages/app/package.json");

        expect(result).toBeNull();
    });

    it("should detect lockfile type", async () => {
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { lodash: "^4.17.0" },
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
        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/lib"), { recursive: true });

        await writeFile(
            join(workspaceRoot, "packages/app/package.json"),
            JSON.stringify({
                name: "app",
                dependencies: { lodash: "^4.17.0" },
            }),
        );

        await writeFile(
            join(workspaceRoot, "packages/lib/package.json"),
            JSON.stringify({
                name: "lib",
                dependencies: { express: "^4.18.0" },
            }),
        );

        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                    "node_modules/express": { version: "4.18.2" },
                },
            }),
        );

        const hasher = new LockfileHasher(workspaceRoot);
        const result1 = await hasher.hashForPackage("packages/app/package.json");
        const result2 = await hasher.hashForPackage("packages/lib/package.json");

        expect(result1).not.toBeNull();
        expect(result2).not.toBeNull();

        // Different packages should have different hashes
        expect(result1!.hash).not.toBe(result2!.hash);

        // Verify correct dependencies
        expect(result1!.dependencies[0]?.name).toBe("lodash");
        expect(result2!.dependencies[0]?.name).toBe("express");
    });
});
