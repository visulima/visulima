import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PnpmAdapter } from "../../../src/release/core/package-managers/pnpm";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("pnpmAdapter — pack", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-pnpm-pack-"));
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "pkg", version: "1.0.0" }));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("returns the tarball path on success (pnpm emits a single object, not array)", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["pack", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify({ filename: "pkg-1.0.0.tgz" }),
            };
        });

        const result = await new PnpmAdapter(runner).pack({ cwd });

        expect(result.tarball).toBe(join(cwd, "pkg-1.0.0.tgz"));
    });

    it("treats absolute filenames as-is", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["pack", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify({ filename: "/abs/path/pkg.tgz" }),
            };
        });

        const result = await new PnpmAdapter(runner).pack({ cwd });

        expect(result.tarball).toBe("/abs/path/pkg.tgz");
    });

    it("respects --pack-destination", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["pack", "--json", "--pack-destination", "/dst"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify({ filename: "pkg-1.0.0.tgz" }),
            };
        });

        const result = await new PnpmAdapter(runner).pack({ cwd, destination: "/dst" });

        expect(result.tarball).toBe(join("/dst", "pkg-1.0.0.tgz"));
    });

    it("throws PUBLISH_FAILED on non-zero exit", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["pack"], () => {
            return { exitCode: 1, stderr: "boom", stdout: "" };
        });

        await expect(new PnpmAdapter(runner).pack({ cwd })).rejects.toThrow(/pnpm pack failed: boom/);
    });

    it("throws when output has no filename field", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["pack"], () => {
            return { exitCode: 0, stderr: "", stdout: "{}" };
        });

        await expect(new PnpmAdapter(runner).pack({ cwd })).rejects.toThrow(/could not parse output/);
    });
});

describe("pnpmAdapter — listWorkspacePackages", () => {
    it("parses pnpm's recursive ls JSON output", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["-r", "ls", "--depth", "-1", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([
                    { name: "@s/a", path: "/r/packages/a", private: false, version: "1.0.0" },
                    { name: "b", path: "/r/packages/b", private: true, version: "2.0.0" },
                ]),
            };
        });

        const list = await new PnpmAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(2);
        expect(list[0]!.name).toBe("@s/a");
        expect(list[1]!.private).toBe(true);
    });

    it("returns empty array on non-zero exit", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["-r", "ls"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new PnpmAdapter(runner).listWorkspacePackages("/r")).resolves.toStrictEqual([]);
    });

    it("returns empty array when JSON is malformed", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["-r", "ls"], () => {
            return { exitCode: 0, stderr: "", stdout: "not json" };
        });

        await expect(new PnpmAdapter(runner).listWorkspacePackages("/r")).resolves.toStrictEqual([]);
    });

    it("filters out entries without a name", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["-r", "ls"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([{}, { name: "ok", version: "1.0.0" }]),
            };
        });

        const list = await new PnpmAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(1);
        expect(list[0]!.name).toBe("ok");
    });
});

describe("pnpmAdapter — installLockfileOnly", () => {
    it("calls pnpm install --lockfile-only", async () => {
        const runner = new MockRunner();
        let called = false;

        runner.on("pnpm", ["install", "--lockfile-only"], () => {
            called = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await new PnpmAdapter(runner).installLockfileOnly({ cwd: "/r" });

        expect(called).toBe(true);
    });

    it("throws on failure", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["install"], () => {
            return { exitCode: 1, stderr: "frozen lock changed", stdout: "" };
        });

        await expect(new PnpmAdapter(runner).installLockfileOnly({ cwd: "/r" })).rejects.toThrow(
            /pnpm install --lockfile-only failed: frozen lock changed/,
        );
    });
});

describe("pnpmAdapter — publish delegates to npm", () => {
    it("invokes `npm publish <tarball>` instead of pnpm publish", async () => {
        const runner = new MockRunner();
        let npmPublishCalled = false;

        runner.on("npm", ["publish", "/tmp/pkg.tgz"], () => {
            npmPublishCalled = true;

            return { exitCode: 0, stderr: "", stdout: "+ pkg@1.0.0" };
        });

        const result = await new PnpmAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(npmPublishCalled).toBe(true);
        expect(result.published).toBe(true);
    });
});

describe("pnpmAdapter — readCatalogYaml", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-pnpm-yaml-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("returns the file content when present", async () => {
        writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        const yaml = await new PnpmAdapter(new MockRunner()).readCatalogYaml(cwd);

        expect(yaml).toContain("packages/*");
    });

    it("returns undefined when the file is missing", async () => {
        const yaml = await new PnpmAdapter(new MockRunner()).readCatalogYaml(cwd);

        expect(yaml).toBeUndefined();
    });
});

describe("pnpmAdapter — detectVersion", () => {
    it("returns trimmed pnpm version", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["--version"], () => {
            return { exitCode: 0, stderr: "", stdout: "10.0.0\n" };
        });

        await expect(new PnpmAdapter(runner).detectVersion("/r")).resolves.toBe("10.0.0");
    });

    it("returns undefined when the CLI is unavailable", async () => {
        const runner = new MockRunner();

        runner.on("pnpm", ["--version"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new PnpmAdapter(runner).detectVersion("/r")).resolves.toBeUndefined();
    });
});
