import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

const manifest = (name: string): string => `import PackageDescription\nlet package = Package(name: "${name}")\n`;

/**
 * Swift packages are task projects only with `swift.discover`. The root manifest
 * is not a task project, and a package under a claimed JS directory is left to it.
 */
describe("swift projects as tasks", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-swift-tasks-"));
        write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write(root, "package.json", JSON.stringify({ name: "root", private: true }));
        write(root, "Package.swift", manifest("root"));
        write(root, "swiftlib/Package.swift", manifest("swiftlib"));
        write(root, "swiftlib/Sources/Lib.swift", "");
        write(root, "packages/web/package.json", JSON.stringify({ name: "web" }));
        write(root, "packages/web/ios/Package.swift", manifest("webios"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("is not a task project unless swift.discover is set", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});

        expect(workspace.projects["swiftlib"]).toBeUndefined();
    });

    it("gives a package build, test and a strict format check, run from its own directory", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { swift: { discover: true } });
        const targets = workspace.projects["swiftlib"]?.targets ?? {};

        expect(targets["build"]?.command).toBe("swift build");
        expect(targets["test"]?.command).toBe("swift test");
        expect(targets["format"]?.command).toBe("swift-format lint --strict --recursive Sources");
    });

    it("names a task project by its Package(name:) literal, as the release side does", () => {
        expect.hasAssertions();

        write(root, "lib-dir/Package.swift", manifest("realname"));

        const { workspace } = discoverWorkspace(root, { swift: { discover: true } });

        expect(workspace.projects["realname"]).toBeDefined();
        expect(workspace.projects["lib-dir"]).toBeUndefined();
    });

    it("leaves the root manifest and a package under a JS package to that package", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { swift: { discover: true } });

        expect(workspace.projects["root"]).toBeUndefined();
        expect(workspace.projects["webios"]).toBeUndefined();
    });
});
