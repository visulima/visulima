import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { YarnAdapter } from "../../../src/release/core/package-managers/yarn";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("yarnAdapter — pack", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-yarn-pack-"));
        writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@scope/pkg", version: "2.3.4" }));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("expands %s/%v placeholders using package.json name and version", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["pack", "--out"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await new YarnAdapter(runner).pack({ cwd });

        // %s lowercases the @ prefix, replaces / with -
        expect(result.tarball).toBe(join(cwd, "scope-pkg-2.3.4.tgz"));
    });

    it("honours a custom filename template", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["pack", "--out"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await new YarnAdapter(runner).pack({ cwd, filename: "pkg.tgz" });

        expect(result.tarball).toBe(join(cwd, "pkg.tgz"));
    });

    it("writes to the destination directory when provided", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["pack", "--out"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await new YarnAdapter(runner).pack({ cwd, destination: "/dist" });

        expect(result.tarball).toBe(join("/dist", "scope-pkg-2.3.4.tgz"));
    });

    it("throws PUBLISH_FAILED on non-zero exit", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["pack"], () => {
            return { exitCode: 1, stderr: "broken", stdout: "" };
        });

        await expect(new YarnAdapter(runner).pack({ cwd })).rejects.toThrow(/yarn pack failed: broken/);
    });
});

describe("yarnAdapter — installLockfileOnly", () => {
    it("uses `yarn install --mode update-lockfile`", async () => {
        expect.hasAssertions();

        let seenArgs: ReadonlyArray<string> | undefined;

        const adapter = new YarnAdapter({
            run: async (_cmd, args) => {
                seenArgs = args;

                return { exitCode: 0, stderr: "", stdout: "" };
            },
        });

        await adapter.installLockfileOnly({ cwd: "/r" });

        expect(seenArgs).toStrictEqual(["install", "--mode", "update-lockfile"]);
    });

    it("throws on failure", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["install"], () => {
            return { exitCode: 1, stderr: "lockfile mismatch", stdout: "" };
        });

        await expect(new YarnAdapter(runner).installLockfileOnly({ cwd: "/r" })).rejects.toThrow(
            /yarn install --mode update-lockfile failed: lockfile mismatch/,
        );
    });
});

describe("yarnAdapter — listWorkspacePackages (NDJSON)", () => {
    it("parses newline-delimited JSON entries", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["workspaces", "list", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "{\"location\":\"packages/a\",\"name\":\"@s/a\"}\n{\"location\":\"packages/b\",\"name\":\"b\"}\n",
            };
        });

        const list = await new YarnAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(2);
        expect(list[0]!.name).toBe("@s/a");
        expect(list[0]!.path).toBe(join("/r", "packages/a"));
    });

    it("skips malformed NDJSON lines", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["workspaces", "list", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "this-is-not-json\n{\"location\":\"a\",\"name\":\"ok\"}\n",
            };
        });

        const list = await new YarnAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(1);
        expect(list[0]!.name).toBe("ok");
    });

    it("skips entries with empty name", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["workspaces", "list", "--json"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "{\"location\":\"a\",\"name\":\"\"}\n{\"location\":\"b\",\"name\":\"b\"}\n",
            };
        });

        const list = await new YarnAdapter(runner).listWorkspacePackages("/r");

        expect(list).toHaveLength(1);
        expect(list[0]!.name).toBe("b");
    });

    it("returns empty list on non-zero exit", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["workspaces", "list", "--json"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new YarnAdapter(runner).listWorkspacePackages("/r")).resolves.toStrictEqual([]);
    });
});

describe("yarnAdapter — publish delegates to npm", () => {
    it("invokes npm publish even though we're on yarn", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        let invokedNpm = false;

        runner.on("npm", ["publish", "/tmp/pkg.tgz"], () => {
            invokedNpm = true;

            return { exitCode: 0, stderr: "", stdout: "+ pkg@1.0.0" };
        });

        const result = await new YarnAdapter(runner).publish({ tarball: "/tmp/pkg.tgz" });

        expect(invokedNpm).toBe(true);
        expect(result.published).toBe(true);
    });
});

describe("yarnAdapter — detectVersion", () => {
    it("returns trimmed version", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["--version"], () => {
            return { exitCode: 0, stderr: "", stdout: "4.5.0\n" };
        });

        await expect(new YarnAdapter(runner).detectVersion("/r")).resolves.toBe("4.5.0");
    });

    it("returns undefined when CLI is absent", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("yarn", ["--version"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(new YarnAdapter(runner).detectVersion("/r")).resolves.toBeUndefined();
    });
});
