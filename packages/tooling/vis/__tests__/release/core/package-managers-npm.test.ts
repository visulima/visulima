import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BunAdapter } from "../../../src/release/core/package-managers/bun";
import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { NpmAdapter } from "../../../src/release/core/package-managers/npm";
import { PnpmAdapter } from "../../../src/release/core/package-managers/pnpm";
import { YarnAdapter } from "../../../src/release/core/package-managers/yarn";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("npmAdapter — pack", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-npm-pack-"));
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "pkg", version: "1.0.0" }));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("returns the tarball path on success", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["pack", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([{ filename: "pkg-1.0.0.tgz" }]),
            };
        });

        const result = await new NpmAdapter(runner).pack({ cwd });

        expect(result.tarball).toBe(join(cwd, "pkg-1.0.0.tgz"));
    });

    it("passes --pack-destination when destination is set", async () => {
        const runner = new MockRunner();
        let seenArgs: ReadonlyArray<string> | undefined;

        runner.on("npm", ["pack", "--json", "--pack-destination", "/out"], () => {
            seenArgs = ["--pack-destination", "/out"];

            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([{ filename: "pkg-1.0.0.tgz" }]),
            };
        });

        const result = await new NpmAdapter(runner).pack({ cwd, destination: "/out" });

        expect(seenArgs).toBeDefined();
        expect(result.tarball).toBe(join("/out", "pkg-1.0.0.tgz"));
    });

    it("throws PUBLISH_FAILED when npm pack exits non-zero", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["pack"], () => {
            return { exitCode: 1, stderr: "boom", stdout: "" };
        });

        await expect(new NpmAdapter(runner).pack({ cwd })).rejects.toThrow(/npm pack failed: boom/);
    });

    it("throws PUBLISH_FAILED when output is missing filename", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["pack"], () => {
            return { exitCode: 0, stderr: "", stdout: "[{}]" };
        });

        await expect(new NpmAdapter(runner).pack({ cwd })).rejects.toThrow(/could not parse output/);
    });
});

describe("npmAdapter — installLockfileOnly", () => {
    it("uses --package-lock-only flag", async () => {
        const runner = new MockRunner();
        let called = false;

        runner.on("npm", ["install", "--package-lock-only"], () => {
            called = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await new NpmAdapter(runner).installLockfileOnly({ cwd: "/r" });

        expect(called).toBe(true);
    });

    it("throws CONFIG_INVALID when install fails", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["install", "--package-lock-only"], () => {
            return {
                exitCode: 1,
                stderr: "lockfile conflict",
                stdout: "",
            };
        });

        await expect(new NpmAdapter(runner).installLockfileOnly({ cwd: "/r" })).rejects.toThrow(
            /npm install --package-lock-only failed: lockfile conflict/,
        );
    });
});

describe("npmAdapter — listWorkspacePackages", () => {
    it("returns empty array on non-zero exit", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["query", ".workspace", "--json"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new NpmAdapter(runner).listWorkspacePackages("/r")).resolves.toEqual([]);
    });

    it("returns empty array when JSON is malformed", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["query", ".workspace", "--json"], () => {
            return { exitCode: 0, stderr: "", stdout: "not json" };
        });

        await expect(new NpmAdapter(runner).listWorkspacePackages("/r")).resolves.toEqual([]);
    });

    it("parses package entries with all fields", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["query", ".workspace", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([
                    { name: "@s/a", path: "/r/packages/a", private: false, version: "1.0.0" },
                    { location: "/r/packages/b", name: "b", private: true, version: "2.0.0" },
                ]),
            };
        });

        const list = await new NpmAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(2);
        expect(list[0]).toEqual({ name: "@s/a", path: "/r/packages/a", private: false, version: "1.0.0" });
        expect(list[1]).toEqual({ name: "b", path: "/r/packages/b", private: true, version: "2.0.0" });
    });

    it("filters out entries without a name", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["query", ".workspace", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: JSON.stringify([{ version: "1.0.0" }, { name: "a", version: "1.0.0" }]),
            };
        });

        const list = await new NpmAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(1);
        expect(list[0]!.name).toBe("a");
    });
});

describe("npmAdapter — publish", () => {
    it("returns published: true on success", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["publish", "/tmp/pkg.tgz"], () => {
            return { exitCode: 0, stderr: "", stdout: "+ pkg@1.0.0" };
        });

        const result = await new NpmAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(result.published).toBe(true);
        expect(result.output).toContain("pkg@1.0.0");
    });

    it("appends optional tag/access/registry/otp/provenance flags", async () => {
        const runner = new MockRunner();
        let seenArgs: ReadonlyArray<string> | undefined;

        runner.on("npm", ["publish", "/tmp/pkg.tgz", "--tag", "next"], () => {
            return { exitCode: 0, stderr: "", stdout: "ok" };
        });

        const adapter = new NpmAdapter({
            run: async (cmd, args) => {
                seenArgs = args;

                return { exitCode: 0, stderr: "", stdout: "ok" };
            },
        });

        await adapter.publish({
            access: "public",
            extraArgs: ["--dry-run"],
            otp: "123456",
            provenance: true,
            registry: "https://r.example.com",
            tag: "next",
            tarball: "/tmp/pkg.tgz",
        });

        expect(seenArgs).toEqual([
            "publish",
            "/tmp/pkg.tgz",
            "--tag",
            "next",
            "--access",
            "public",
            "--registry",
            "https://r.example.com",
            "--otp",
            "123456",
            "--provenance",
            "--dry-run",
        ]);
    });

    it("detects alreadyPublished via EPUBLISHCONFLICT in stderr", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["publish"], () => {
            return {
                exitCode: 1,
                stderr: "npm ERR! code EPUBLISHCONFLICT — cannot publish over the previously published versions: 1.0.0",
                stdout: "",
            };
        });

        const result = await new NpmAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(result.published).toBe(false);
        expect(result.alreadyPublished).toBe(true);
    });

    it("detects alreadyPublished via 409 forbidden", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["publish"], () => {
            return {
                exitCode: 1,
                stderr: "npm ERR! 403 Forbidden — PUT 409 some-registry/pkg",
                stdout: "",
            };
        });

        const result = await new NpmAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(result.alreadyPublished).toBe(true);
    });

    it("throws PUBLISH_FAILED on non-conflict errors", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["publish"], () => {
            return {
                exitCode: 1,
                stderr: "ETIMEDOUT — network unreachable",
                stdout: "",
            };
        });

        await expect(new NpmAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" })).rejects.toThrow(
            /npm publish failed[\s\S]*ETIMEDOUT/,
        );
    });
});

describe("npmAdapter — detectVersion", () => {
    it("returns trimmed stdout on success", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["--version"], () => {
            return { exitCode: 0, stderr: "", stdout: "11.5.1\n" };
        });

        await expect(new NpmAdapter(runner).detectVersion("/r")).resolves.toBe("11.5.1");
    });

    it("returns undefined on failure", async () => {
        const runner = new MockRunner();

        runner.on("npm", ["--version"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new NpmAdapter(runner).detectVersion("/r")).resolves.toBeUndefined();
    });
});

describe("publishNative — per-pm command construction (publishStrategy: native)", () => {
    const capture = (): { adapterRunner: CommandRunner; seen: { args: ReadonlyArray<string>; command: string; cwd: string } } => {
        const seen = { args: [] as ReadonlyArray<string>, command: "", cwd: "" };
        const adapterRunner: CommandRunner = {
            run: async (command, args, options) => {
                seen.command = command;
                seen.args = args;
                seen.cwd = options.cwd;

                return { exitCode: 0, stderr: "", stdout: "+ pkg@1.0.0" };
            },
        };

        return { adapterRunner, seen };
    };

    it("npm: runs `npm publish` in the package dir with flags", async () => {
        const { adapterRunner, seen } = capture();

        const result = await new NpmAdapter(adapterRunner).publishNative({
            access: "public",
            cwd: "/repo/pkg",
            provenance: true,
            tag: "next",
        });

        expect(result.published).toBe(true);
        expect(seen.command).toBe("npm");
        expect(seen.args).toEqual(["publish", "--tag", "next", "--access", "public", "--provenance"]);
        expect(seen.cwd).toBe("/repo/pkg");
    });

    it("pnpm: runs `pnpm publish --no-git-checks` in the package dir", async () => {
        const { adapterRunner, seen } = capture();

        await new PnpmAdapter(adapterRunner).publishNative({ cwd: "/repo/pkg", tag: "latest" });

        expect(seen.command).toBe("pnpm");
        expect(seen.args).toEqual(["publish", "--no-git-checks", "--tag", "latest"]);
    });

    it("yarn: runs `yarn npm publish` (no --otp/--registry flags)", async () => {
        const { adapterRunner, seen } = capture();

        await new YarnAdapter(adapterRunner).publishNative({ access: "restricted", cwd: "/repo/pkg", otp: "123456", registry: "https://r.example.com" });

        expect(seen.command).toBe("yarn");
        expect(seen.args).toEqual(["npm", "publish", "--access", "restricted"]);
    });

    it("bun: runs `bun publish` (no --provenance/--otp)", async () => {
        const { adapterRunner, seen } = capture();

        await new BunAdapter(adapterRunner).publishNative({ cwd: "/repo/pkg", otp: "123456", provenance: true, tag: "beta" });

        expect(seen.command).toBe("bun");
        expect(seen.args).toEqual(["publish", "--tag", "beta"]);
    });

    it("maps EPUBLISHCONFLICT to alreadyPublished", async () => {
        const conflictRunner: CommandRunner = {
            run: async () => {
                return { exitCode: 1, stderr: "npm error code EPUBLISHCONFLICT", stdout: "" };
            },
        };

        const result = await new PnpmAdapter(conflictRunner).publishNative({ cwd: "/repo/pkg" });

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
    });
});
