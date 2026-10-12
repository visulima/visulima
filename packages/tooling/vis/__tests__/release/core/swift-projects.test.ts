import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverSwiftPackages } from "../../../src/release/core/swift-projects";

const manifest = (name: string, extra = ""): string =>
    `// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "${name}",\n    dependencies: [${extra}],\n    targets: [.target(name: "Other")]\n)\n`;

/**
 * Swift packages as release packages. The name is the Package(name:) literal,
 * local `.package(path:)` dependencies order the release, and anything vis cannot
 * read is refused.
 */
describe("swift projects", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const discover = (claimed: string[] = []) => discoverSwiftPackages({ claimedDirs: new Set(claimed.map((dir) => join(cwd, dir))), cwd });

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-swift-")));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("names each package by its Package(name:) literal, not a target name", async () => {
        expect.hasAssertions();

        write("Package.swift", manifest("mylib"));
        write("tools/cli/Package.swift", manifest("mycli"));

        const projects = await discover();

        expect(projects.map((project) => [project.package.name, project.package.ecosystem, project.package.version])).toStrictEqual([
            ["mylib", "swift", "0.0.0"],
            ["mycli", "swift", "0.0.0"],
        ]);
    });

    it("orders a package after the local package it depends on, with no version written", async () => {
        expect.hasAssertions();

        write("core/Package.swift", manifest("core"));
        write("app/Package.swift", manifest("app", "\n        .package(path: \"../core\"),\n        .package(url: \"https://example.com/x.git\", from: \"1.0.0\")"));

        const projects = await discover();
        const app = projects.find((project) => project.package.name === "app");

        expect(app?.package.manifest.dependencies).toStrictEqual({ core: "*" });
    });

    it("skips directories already claimed by a JS package and .build output", async () => {
        expect.hasAssertions();

        write("Package.swift", manifest("root"));
        write("claimed/Package.swift", manifest("claimed"));
        write(".build/checkouts/dep/Package.swift", manifest("dep"));

        const projects = await discover(["claimed"]);

        expect(projects.map((project) => project.package.name)).toStrictEqual(["root"]);
    });

    it("refuses a package name that is not a string literal", async () => {
        expect.hasAssertions();

        write("Package.swift", "let name = \"x\"\nlet package = Package(name: name)\n");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a name that is not a valid release name", async () => {
        expect.hasAssertions();

        write("Package.swift", manifest("MyLib"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses two packages that declare the same name", async () => {
        expect.hasAssertions();

        write("a/Package.swift", manifest("same"));
        write("b/Package.swift", manifest("same"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a path dependency that is not a string literal", async () => {
        expect.hasAssertions();

        write("Package.swift", manifest("app", "\n        .package(path: dir)"));

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });
});
