import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BunAdapter } from "../../../src/release/core/package-managers/bun";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("bunAdapter — pack", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-bun-pack-"));
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@s/pkg", version: "1.2.3" }));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("parses the tarball filename from bun pm pack stdout", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["pm", "pack"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "Created tarball s-pkg-1.2.3.tgz at /tmp\n",
            };
        });

        const result = await new BunAdapter(runner).pack({ cwd });

        expect(result.tarball).toContain("s-pkg-1.2.3.tgz");
    });

    it("treats absolute filenames in stdout as-is", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["pm", "pack"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "/abs/out/pkg.tgz\n",
            };
        });

        const result = await new BunAdapter(runner).pack({ cwd });

        expect(result.tarball).toBe("/abs/out/pkg.tgz");
    });

    it("falls back to deriving the tarball name from package.json when stdout has no filename", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["pm", "pack"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "no useful output here",
            };
        });

        const result = await new BunAdapter(runner).pack({ cwd });

        // @s/pkg → s-pkg, then `-1.2.3.tgz`
        expect(result.tarball).toBe(join(cwd, "s-pkg-1.2.3.tgz"));
    });

    it("forwards --destination to bun pm pack", async () => {
        expect.hasAssertions();

        let seenArgs: ReadonlyArray<string> | undefined;

        const adapter = new BunAdapter({
            run: async (_cmd, args) => {
                seenArgs = args;

                return { exitCode: 0, stderr: "", stdout: "Created tarball /dst/s-pkg-1.2.3.tgz" };
            },
        });

        await adapter.pack({ cwd, destination: "/dst" });

        // bun pm pack supports --destination from the pinned minVersion (1.1.36)
        // but NOT --filename (added later). The adapter renames post-pack
        // when a filename override is requested.
        expect(seenArgs).toStrictEqual(["pm", "pack", "--destination", "/dst"]);
    });

    it("renames the tarball post-pack when filename is requested", async () => {
        expect.hasAssertions();

        const dest = mkdtempSync(join(tmpdir(), "vis-bun-pack-dest-"));
        const tarballPath = join(dest, "s-pkg-1.2.3.tgz");

        writeFileSync(tarballPath, "tarball");

        const adapter = new BunAdapter({
            run: async () => {
                return {
                    exitCode: 0,
                    stderr: "",
                    stdout: `Created tarball ${tarballPath}\n`,
                };
            },
        });

        const result = await adapter.pack({ cwd, destination: dest, filename: "custom.tgz" });
        const fs = await import("node:fs/promises");

        expect(result.tarball).toBe(join(dest, "custom.tgz"));

        await fs.rm(dest, { force: true, recursive: true });
    });

    it("throws PUBLISH_FAILED on non-zero exit", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["pm", "pack"], () => {
            return { exitCode: 1, stderr: "fail", stdout: "" };
        });

        await expect(new BunAdapter(runner).pack({ cwd })).rejects.toThrow(/bun pm pack failed: fail/);
    });
});

describe("bunAdapter — installLockfileOnly", () => {
    it("invokes bun install --lockfile-only", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let called = false;

        runner.on("bun", ["install", "--lockfile-only"], () => {
            called = true;

            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await new BunAdapter(runner).installLockfileOnly({ cwd: "/r" });

        expect(called).toBe(true);
    });

    it("throws on failure", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["install"], () => {
            return { exitCode: 1, stderr: "lockfile conflict", stdout: "" };
        });

        await expect(new BunAdapter(runner).installLockfileOnly({ cwd: "/r" })).rejects.toThrow(
            /bun install --lockfile-only failed: lockfile conflict/,
        );
    });
});

describe("bunAdapter — listWorkspacePackages (no first-class CLI)", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-bun-ws-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("discovers packages under workspaces[] globs", async () => {
        expect.hasAssertions();

        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));

        mkdirSync(join(cwd, "packages", "a"), { recursive: true });
        writeFileSync(join(cwd, "packages", "a", "package.json"), JSON.stringify({ name: "a", version: "1.0.0" }));

        mkdirSync(join(cwd, "packages", "b"), { recursive: true });
        writeFileSync(join(cwd, "packages", "b", "package.json"), JSON.stringify({ name: "b", private: true, version: "2.0.0" }));

        const list = await new BunAdapter(new MockRunner()).listWorkspacePackages(cwd);

        expect(list.map((p) => p.name).sort()).toStrictEqual(["a", "b"]);

        const bEntry = list.find((p) => p.name === "b");

        expect(bEntry?.private).toBe(true);
    });

    it("supports the workspaces.packages object form", async () => {
        expect.hasAssertions();

        writeFileSync(join(cwd, "package.json"), JSON.stringify({
            name: "root",
            workspaces: { packages: ["pkg-*"] },
        }));

        mkdirSync(join(cwd, "pkg-a"), { recursive: true });
        writeFileSync(join(cwd, "pkg-a", "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0" }));

        const list = await new BunAdapter(new MockRunner()).listWorkspacePackages(cwd);

        expect(list).toHaveLength(1);
        expect(list[0]!.name).toBe("pkg-a");
    });

    it("skips node_modules + dotfiles during traversal", async () => {
        expect.hasAssertions();

        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "root", workspaces: ["**/package"] }));

        mkdirSync(join(cwd, "node_modules", "thing", "package"), { recursive: true });
        writeFileSync(
            join(cwd, "node_modules", "thing", "package", "package.json"),
            JSON.stringify({ name: "should-not-see", version: "0.0.0" }),
        );

        mkdirSync(join(cwd, ".cache", "package"), { recursive: true });
        writeFileSync(join(cwd, ".cache", "package", "package.json"), JSON.stringify({ name: "hidden", version: "0.0.0" }));

        const list = await new BunAdapter(new MockRunner()).listWorkspacePackages(cwd);
        const names = list.map((entry) => entry.name);

        // Both candidate packages live under node_modules / a dotdir, so neither
        // should be discovered (asserted unconditionally — the list may be empty).
        expect(names).not.toContain("should-not-see");
        expect(names).not.toContain("hidden");
    });

    it("returns empty array when workspaces field is missing", async () => {
        expect.hasAssertions();

        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "root" }));

        await expect(new BunAdapter(new MockRunner()).listWorkspacePackages(cwd)).resolves.toStrictEqual([]);
    });

    it("returns empty array when package.json is missing", async () => {
        expect.hasAssertions();
        await expect(new BunAdapter(new MockRunner()).listWorkspacePackages(cwd)).resolves.toStrictEqual([]);
    });
});

describe("bunAdapter — publish delegates to npm", () => {
    it("invokes npm publish (bun lacks OIDC + provenance)", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let npmInvoked = false;

        runner.on("npm", ["publish", "/tmp/pkg.tgz"], () => {
            npmInvoked = true;

            return { exitCode: 0, stderr: "", stdout: "+ pkg@1.0.0" };
        });

        const result = await new BunAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(npmInvoked).toBe(true);
        expect(result.published).toBe(true);
    });
});

describe("bunAdapter — detectVersion", () => {
    it("returns trimmed version", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["--version"], () => {
            return { exitCode: 0, stderr: "", stdout: "1.2.4\n" };
        });

        await expect(new BunAdapter(runner).detectVersion("/r")).resolves.toBe("1.2.4");
    });

    it("returns undefined when CLI is absent", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("bun", ["--version"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new BunAdapter(runner).detectVersion("/r")).resolves.toBeUndefined();
    });
});
