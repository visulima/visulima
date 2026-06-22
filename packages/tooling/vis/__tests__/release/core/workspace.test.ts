import { describe, expect, it } from "vitest";

import { discoverPackages, isPackageManaged, mergePerPackageConfig, resolveVersionActionsId } from "../../../src/release/core/workspace";
import { VisReleaseError } from "../../../src/release/errors";
import type { PackageManifest, WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string, extras: Partial<PackageManifest> = {}): { manifest: PackageManifest; manifestPath: string } => {
    return {
        manifest: { name, version: "1.0.0", ...extras },
        manifestPath: `/repo/packages/${name}/package.json`,
    };
};

describe("workspace: discoverPackages", () => {
    it("returns packages from the reader", async () => {
        const reader = {
            listPackages: async () => [mkPkg("a"), mkPkg("b"), mkPkg("c")],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });

        expect(result.packages.map((p) => p.name).sort()).toStrictEqual(["a", "b", "c"]);
    });

    it("excludes native-addon platform packages under <parent>/npm/ (RFC §12.4)", async () => {
        const reader = {
            listPackages: async () => [
                // Native-addon parent (napi field) at packages/vis.
                { manifest: { name: "@scope/vis", napi: { binaryName: "vis" }, version: "1.0.0" } as unknown as PackageManifest, manifestPath: "/repo/packages/vis/package.json" },
                // Platform packages live under the parent's npm/ dir — managed
                // by the parent, must NOT be discovered standalone.
                { manifest: { name: "@scope/vis-binding-linux-x64", version: "1.0.0" } as PackageManifest, manifestPath: "/repo/packages/vis/npm/linux-x64/package.json" },
                { manifest: { name: "@scope/vis-binding-darwin-arm64", version: "1.0.0" } as PackageManifest, manifestPath: "/repo/packages/vis/npm/darwin-arm64/package.json" },
                // Unrelated package — kept.
                mkPkg("@scope/other"),
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });
        const names = result.packages.map((p) => p.name);

        expect(names).toContain("@scope/vis");
        expect(names).toContain("@scope/other");
        expect(names).not.toContain("@scope/vis-binding-linux-x64");
        expect(names).not.toContain("@scope/vis-binding-darwin-arm64");
    });

    it("excludes platform packages of an explicit native-addon parent (no napi field)", async () => {
        const reader = {
            listPackages: async () => [
                { manifest: { name: "@scope/native", version: "1.0.0", "vis-release": { versionActions: "native-addon" } } as unknown as PackageManifest, manifestPath: "/repo/packages/native/package.json" },
                { manifest: { name: "@scope/native-binding-linux-x64", version: "1.0.0" } as PackageManifest, manifestPath: "/repo/packages/native/npm/linux-x64/package.json" },
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });

        expect(result.packages.map((p) => p.name)).toStrictEqual(["@scope/native"]);
    });

    it("rejects duplicate package names", async () => {
        const reader = {
            listPackages: async () => [mkPkg("a"), mkPkg("a")],
        };

        await expect(discoverPackages(reader, { defaultManaged: true })).rejects.toThrow(VisReleaseError);
    });

    it("skips anonymous packages (missing name)", async () => {
        const reader = {
            listPackages: async () => [mkPkg("a"), { manifest: { name: "" as unknown as string, version: "1.0.0" }, manifestPath: "/x/p.json" }],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });

        expect(result.packages).toHaveLength(1);
        expect(result.packages[0]?.name).toBe("a");
    });

    it("filters via release.ignore globs", async () => {
        const reader = {
            listPackages: async () => [mkPkg("@scope/a"), mkPkg("@scope/internal-b"), mkPkg("@scope/c")],
        };

        const result = await discoverPackages(reader, { defaultManaged: true, ignore: ["@scope/internal-*"] });

        expect(result.packages.map((p) => p.name).sort()).toStrictEqual(["@scope/a", "@scope/c"]);
    });

    it("respects per-package managed: false override", async () => {
        const reader = {
            listPackages: async () => [
                mkPkg("a"),
                mkPkg("b", { "vis-release": { managed: false } }),
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });

        expect(result.packages.map((p) => p.name)).toStrictEqual(["a"]);
    });

    it("respects per-package managed: true override even when defaultManaged is false", async () => {
        const reader = {
            listPackages: async () => [
                mkPkg("a"),
                mkPkg("b", { "vis-release": { managed: true } }),
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: false });

        expect(result.packages.map((p) => p.name)).toStrictEqual(["b"]);
    });

    it("skips private packages by default", async () => {
        const reader = {
            listPackages: async () => [
                mkPkg("a"),
                mkPkg("internal", { private: true }),
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: true });

        expect(result.packages.map((p) => p.name)).toStrictEqual(["a"]);
    });

    it("includes private packages when privatePackages.version is true", async () => {
        const reader = {
            listPackages: async () => [
                mkPkg("a"),
                mkPkg("internal", { private: true }),
            ],
        };

        const result = await discoverPackages(reader, { defaultManaged: true, privatePackages: { tag: false, version: true } });

        expect(result.packages.map((p) => p.name).sort()).toStrictEqual(["a", "internal"]);
    });

    it("rejects package names with shell metacharacters (RFC §19.4)", async () => {
        const reader = {
            listPackages: async () => [{
                manifest: { name: "evil$(rm -rf /)", version: "1.0.0" } as PackageManifest,
                manifestPath: "/repo/packages/evil/package.json",
            }],
        };

        await expect(discoverPackages(reader, { defaultManaged: true })).rejects.toThrow(VisReleaseError);
    });

    it("rejects package names exceeding 214 chars", async () => {
        const longName = `@scope/${"a".repeat(214)}`;
        const reader = {
            listPackages: async () => [{
                manifest: { name: longName, version: "1.0.0" } as PackageManifest,
                manifestPath: "/repo/packages/long/package.json",
            }],
        };

        await expect(discoverPackages(reader, { defaultManaged: true })).rejects.toThrow(VisReleaseError);
    });

    it("rejects manifestPath outside the workspace cwd when cwd is provided", async () => {
        const reader = {
            listPackages: async () => [{
                manifest: { name: "evil", version: "1.0.0" } as PackageManifest,
                manifestPath: "/etc/passwd-pkg/package.json",
            }],
        };

        await expect(discoverPackages(reader, { defaultManaged: true }, { cwd: "/repo" })).rejects.toThrow(VisReleaseError);
    });

    it("accepts manifestPath inside the workspace cwd", async () => {
        const reader = {
            listPackages: async () => [{
                manifest: { name: "a", version: "1.0.0" } as PackageManifest,
                manifestPath: "/repo/packages/a/package.json",
            }],
        };

        const result = await discoverPackages(reader, { defaultManaged: true }, { cwd: "/repo" });

        expect(result.packages).toHaveLength(1);
    });
});

describe("workspace: mergePerPackageConfig", () => {
    it("package.json wins over root config", () => {
        const merged = mergePerPackageConfig(
            "a",
            { name: "a", version: "1.0.0", "vis-release": { versionActions: "native-addon" } },
            { packages: { a: { versionActions: "npm" } } },
        );

        expect(merged.versionActions).toBe("native-addon");
    });

    it("root config supplies fields when package.json is absent", () => {
        const merged = mergePerPackageConfig(
            "a",
            { name: "a", version: "1.0.0" },
            { packages: { a: { registry: "https://x", versionActions: "private" } } },
        );

        expect(merged.versionActions).toBe("private");
        expect(merged.registry).toBe("https://x");
    });
});

describe("workspace: resolveVersionActionsId auto-detection", () => {
    const wsPkg = (manifest: PackageManifest, isPrivate = false): WorkspacePackage => {
        return {
            dir: "/x",
            manifest,
            manifestPath: "/x/package.json",
            name: manifest.name,
            private: isPrivate,
            version: manifest.version,
        };
    };

    it("auto-detects native-addon via napi field", () => {
        const id = resolveVersionActionsId(wsPkg({ name: "a", napi: { binaryName: "a" }, version: "1.0.0" }), {});

        expect(id).toBe("native-addon");
    });

    it("auto-detects private for private:true packages", () => {
        const id = resolveVersionActionsId(wsPkg({ name: "a", version: "1.0.0" }, true), {});

        expect(id).toBe("private");
    });

    it("defaults to npm", () => {
        const id = resolveVersionActionsId(wsPkg({ name: "a", version: "1.0.0" }), {});

        expect(id).toBe("npm");
    });

    it("explicit per-package config overrides auto-detection", () => {
        const id = resolveVersionActionsId(wsPkg({ name: "a", napi: { binaryName: "a" }, version: "1.0.0" }), { versionActions: "npm" });

        expect(id).toBe("npm");
    });
});

describe("workspace: isPackageManaged precedence (RFC §17.1 5-rule order)", () => {
    const m = (name = "a"): PackageManifest => {
        return { name, version: "1.0.0" };
    };

    it("rule 1: explicit managed:false always wins", () => {
        expect(isPackageManaged("a", m(), { managed: false }, { defaultManaged: true, include: ["a"] })).toBe(false);
    });

    it("rule 2: ignore glob wins over default", () => {
        expect(isPackageManaged("a", m(), {}, { defaultManaged: true, ignore: ["a"] })).toBe(false);
    });

    it("rule 3: explicit managed:true overrides ignore", () => {
        // Note: bumpy's documented order has explicit managed:true after ignore; verify
        expect(isPackageManaged("a", m(), { managed: true }, { defaultManaged: false, ignore: ["a"] })).toBe(true);
    });

    it("rule 4: include glob wins over private + default-false", () => {
        expect(isPackageManaged("a", { ...m(), private: true }, {}, { defaultManaged: false, include: ["a"] })).toBe(true);
    });

    it("rule 5: private:true excluded when privatePackages.version is false", () => {
        expect(isPackageManaged("a", { ...m(), private: true }, {}, { defaultManaged: true })).toBe(false);
    });

    it("rule 6: defaults to defaultManaged", () => {
        expect(isPackageManaged("a", m(), {}, { defaultManaged: false })).toBe(false);
        expect(isPackageManaged("a", m(), {}, { defaultManaged: true })).toBe(true);
    });
});
