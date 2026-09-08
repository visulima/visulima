import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { defaultTagFor, getCurrentBranch, getCurrentSha, getShortSha, tagExists, tagExistsRemote, toRepoRelativePath } from "../../../src/release/core/git";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("git: defaultTagFor", () => {
    it("matches the semantic-release / changesets / bumpy convention", () => {
        expect.hasAssertions();
        expect(defaultTagFor("@scope/pkg", "1.2.3")).toBe("@scope/pkg@1.2.3");
        expect(defaultTagFor("plain", "0.0.1")).toBe("plain@0.0.1");
    });

    it("includes prerelease + build-metadata in tags", () => {
        expect.hasAssertions();
        expect(defaultTagFor("pkg", "1.0.0-alpha.0")).toBe("pkg@1.0.0-alpha.0");
        expect(defaultTagFor("pkg", "1.0.0+build.7")).toBe("pkg@1.0.0+build.7");
    });
});

describe("git: getCurrentBranch", () => {
    it("returns the trimmed branch name on success", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "alpha\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBe("alpha");
    });

    it("returns undefined for detached HEAD", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "HEAD\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });

    it("returns undefined for empty output", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });

    it("returns undefined on non-zero exit", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 128, stderr: "fatal", stdout: "" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });
});

describe("git: getCurrentSha + getShortSha", () => {
    it("returns the trimmed sha on success", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc1234567890\n" };
        });
        runner.on("git", ["rev-parse", "--short", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc1234\n" };
        });

        await expect(getCurrentSha({ cwd: "/r", runner })).resolves.toBe("abc1234567890");
        await expect(getShortSha({ cwd: "/r", runner })).resolves.toBe("abc1234");
    });

    it("returns undefined on non-zero exit", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 128, stderr: "fatal", stdout: "" };
        });

        await expect(getCurrentSha({ cwd: "/r", runner })).resolves.toBeUndefined();
    });
});

describe("git: tagExists", () => {
    it("returns true when local tag exists", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--verify", "--quiet", "refs/tags/pkg@1.0.0"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc1234" };
        });

        await expect(tagExists({ cwd: "/r", runner }, "pkg@1.0.0")).resolves.toBe(true);
    });

    it("returns false when local tag is missing", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--verify", "--quiet", "refs/tags/pkg@9.9.9"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(tagExists({ cwd: "/r", runner }, "pkg@9.9.9")).resolves.toBe(false);
    });
});

describe("git: tagExistsRemote", () => {
    it("returns true when remote tag exists", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["ls-remote", "--tags", "origin", "pkg@1.0.0"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: "abc1234\trefs/tags/pkg@1.0.0\n",
            };
        });

        await expect(tagExistsRemote({ cwd: "/r", runner }, "pkg@1.0.0")).resolves.toBe(true);
    });

    it("returns false when remote returns no output", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();

        runner.on("git", ["ls-remote", "--tags", "origin", "missing"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await expect(tagExistsRemote({ cwd: "/r", runner }, "missing")).resolves.toBe(false);
    });
});

describe("git: toRepoRelativePath", () => {
    const created: string[] = [];

    afterAll(() => {
        for (const dir of created) {
            rmSync(dir, { force: true, recursive: true });
        }
    });

    const mkRoot = (): string => {
        const dir = realpathSync(mkdtempSync(join(tmpdir(), "vis-reporel-")));

        created.push(dir);

        return dir;
    };

    it("returns a plain repo-relative POSIX path", async () => {
        expect.hasAssertions();

        const root = mkRoot();
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--show-toplevel"], () => {
            return { exitCode: 0, stderr: "", stdout: `${root}\n` };
        });

        await expect(toRepoRelativePath({ cwd: root, runner }, join(root, ".vis", "release", "ci-abc.md"))).resolves.toBe(".vis/release/ci-abc.md");
    });

    it("does not escape the tree when git spells the toplevel differently", async () => {
        expect.hasAssertions();

        // Reproduces the shape of two real platform bugs with one mechanism:
        // on Windows `git rev-parse --show-toplevel` reports the long name
        // while `os.tmpdir()` yields the 8.3 short form (`RUNNER~1`), and on
        // macOS `/var` is a symlink to `/private/var`. Both make git's
        // toplevel and the caller's absolute path different spellings of the
        // same directory. A symlinked alias reproduces that portably.
        const root = mkRoot();
        const alias = join(root, "alias");
        const real = join(root, "real");

        mkdirSync(join(real, ".vis", "release"), { recursive: true });
        writeFileSync(join(real, ".vis", "release", "ci-abc.md"), "x");
        symlinkSync(real, alias, "dir");

        const runner = new MockRunner();

        // git reports the REAL path; the caller holds the ALIAS path.
        runner.on("git", ["rev-parse", "--show-toplevel"], () => {
            return { exitCode: 0, stderr: "", stdout: `${real}\n` };
        });

        const result = await toRepoRelativePath({ cwd: real, runner }, join(alias, ".vis", "release", "ci-abc.md"));

        expect(result).toBe(".vis/release/ci-abc.md");
        expect(result.startsWith("..")).toBe(false);
    });

    it("still resolves a path whose file does not exist yet", async () => {
        expect.hasAssertions();

        // `--generate` builds the change-file path before writing it.
        const root = mkRoot();
        const alias = join(root, "alias");
        const real = join(root, "real");

        mkdirSync(real, { recursive: true });
        symlinkSync(real, alias, "dir");

        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--show-toplevel"], () => {
            return { exitCode: 0, stderr: "", stdout: `${real}\n` };
        });

        await expect(toRepoRelativePath({ cwd: real, runner }, join(alias, ".vis", "release", "ci-notyet.md"))).resolves.toBe(".vis/release/ci-notyet.md");
    });
});
