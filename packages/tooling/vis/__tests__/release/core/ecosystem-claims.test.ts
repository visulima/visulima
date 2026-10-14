import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { RELEASE_ECOSYSTEMS } from "../../../src/release/core/ecosystems";
import type { PerPackageReleaseConfig, WorkspacePackage } from "../../../src/release/types";

/**
 * Every ecosystem claims a directory the same way: a JS package that releases it
 * (`versionActions`), or an `extraFiles` rule on the ecosystem's own manifest. A
 * near-miss filename claims nothing. Cargo and Python read their own config keys
 * and are covered elsewhere. Claims are deduplicated because consumers take a Set.
 */
const cwd = resolve("ws");
const dir = resolve("ws", "app");

const pkg = (packageDir: string = dir): WorkspacePackage => {
    return {
        dir: packageDir,
        manifest: { name: "app", private: false, version: "1.0.0" },
        manifestPath: resolve(packageDir, "package.json"),
        name: "app",
        private: false,
        version: "1.0.0",
    };
};

type ClaimedDirs = (pkg: WorkspacePackage, perPkg: PerPackageReleaseConfig, cwd: string) => string[];

const claims = (id: string, perPkg: PerPackageReleaseConfig, p: WorkspacePackage = pkg()): string[] => {
    const eco = RELEASE_ECOSYSTEMS.find((e) => e.id === id);

    return [...new Set((eco as unknown as { claimedDirs: ClaimedDirs }).claimedDirs(p, perPkg, cwd))];
};

const manifests: [string, string][] = [
    ["composer", "composer.json"],
    ["go", "go.mod"],
    ["gradle", "build.gradle.kts"],
    ["hex", "mix.exs"],
    ["maven", "pom.xml"],
    ["nuget", "app.csproj"],
    ["swift", "Package.swift"],
    ["zig", "build.zig.zon"],
    ["dart", "pubspec.yaml"],
];

describe("ecosystem claim rules", () => {
    it.each(manifests)("%s claims its directory when a JS package releases it", (id) => {
        expect.hasAssertions();

        expect(claims(id, { versionActions: id })).toStrictEqual([dir]);
    });

    it.each(manifests)("%s claims its directory through an extraFiles rule on its manifest", (id, file) => {
        expect.hasAssertions();

        expect(claims(id, { extraFiles: [{ path: file }] as never })).toStrictEqual([dir]);
    });

    it.each(manifests)("%s does not claim for a near-miss filename at the workspace root", (id) => {
        expect.hasAssertions();

        // At the root the JS-directory rule is exempt, so only manifest matches could claim.
        expect(claims(id, { extraFiles: [{ path: "not-the-manifest.txt" }] as never }, pkg(cwd))).toStrictEqual([]);
    });

    it("maven does not claim a pom whose name only ends in pom.xml", () => {
        expect.hasAssertions();

        expect(claims("maven", { extraFiles: [{ path: "legacy-pom.xml" }] as never }, pkg(cwd))).toStrictEqual([]);
    });

    it("composer and go do not claim a directory for an unrelated extraFiles rule", () => {
        expect.hasAssertions();

        expect(claims("composer", { extraFiles: [{ path: "go.mod" }] as never })).toStrictEqual([]);
        expect(claims("go", { extraFiles: [{ path: "composer.json" }] as never })).toStrictEqual([]);
    });

    it("swift keeps the JS-directory subtree claim for a non-root JS package", () => {
        expect.hasAssertions();

        expect(claims("swift", {})).toStrictEqual([dir]);
    });

    it("swift does not claim the workspace root just because it is a JS package", () => {
        expect.hasAssertions();

        expect(claims("swift", {}, pkg(cwd))).toStrictEqual([]);
    });

    it("swift claims a workspace-root package that releases its Package.swift via versionActions", () => {
        expect.hasAssertions();

        expect(claims("swift", { versionActions: "swift" }, pkg(cwd))).toStrictEqual([cwd]);
    });
});
