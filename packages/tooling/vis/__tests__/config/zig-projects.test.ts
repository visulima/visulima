import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";
import { resolveZigProjectDirectories } from "../../src/config/zig-projects";
import { zigDetector } from "../../src/inference/detectors/zig";

describe("zig task projects", () => {
    let root: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(root, rel, ".."), { recursive: true });
        writeFileSync(join(root, rel), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-zig-tasks-")));
        write("pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write("package.json", JSON.stringify({ name: "root", private: true }));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns the in-workspace path dependencies, not the root, and skips claimed directories", () => {
        expect.hasAssertions();

        write("build.zig.zon", ".{ .name = .app, .version = \"1.0.0\", .dependencies = .{ .core = .{ .path = \"packages/core\" }, .web = .{ .path = \"web\" } }, .paths = .{ \"build.zig\" } }\n");
        write("packages/core/build.zig.zon", ".{ .name = .core, .version = \"1.0.0\", .paths = .{ \"build.zig\" } }\n");
        write("web/build.zig.zon", ".{ .name = .web, .version = \"1.0.0\", .paths = .{ \"build.zig\" } }\n");

        expect(resolveZigProjectDirectories(root, []).sort()).toStrictEqual(["packages/core", "web"]);
        expect(resolveZigProjectDirectories(root, ["web"])).toStrictEqual(["packages/core"]);
    });

    it("gives a discovered Zig package its build, test and format:check targets through discoverWorkspace", () => {
        expect.hasAssertions();

        write("build.zig.zon", ".{ .name = .app, .version = \"1.0.0\", .dependencies = .{ .core = .{ .path = \"packages/core\" } }, .paths = .{ \"build.zig\" } }\n");
        write("packages/core/build.zig.zon", ".{ .name = .core, .version = \"1.0.0\", .paths = .{ \"build.zig\" } }\n");

        const { workspace } = discoverWorkspace(root, { zig: { discover: true } });
        const targets = workspace.projects["core"]?.targets ?? {};

        expect(targets["build"]).toMatchObject({ command: "zig build" });
        expect(targets["test"]).toMatchObject({ command: "zig build test" });
        expect(targets["format:check"]).toMatchObject({ command: "zig fmt --check ." });
    });

    it("returns nothing when the root manifest does not parse", () => {
        expect.hasAssertions();

        write("build.zig.zon", ".{ .name = .app, .version = version_str }\n");

        expect(resolveZigProjectDirectories(root, [])).toStrictEqual([]);
    });

    it("targets build, test and a format check that fails on unformatted code", () => {
        expect.hasAssertions();

        const { targets } = zigDetector.detect({ projectDirectory: join(root, "core"), workspaceRoot: root } as never) as { targets: Record<string, { command: string; type?: string }> };

        expect(targets.build?.command).toBe("zig build");
        expect(targets.test).toMatchObject({ command: "zig build test", type: "test" });
        expect(targets["format:check"]).toMatchObject({ command: "zig fmt --check .", type: "test" });
    });
});
