import { describe, expect, it } from "vitest";

import {
    defaultTagFor,
    getCurrentBranch,
    getCurrentSha,
    getShortSha,
    hasUncommittedChanges,
    tagExists,
    tagExistsRemote,
} from "../../../src/release/core/git";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe("git: defaultTagFor", () => {
    it("matches the semantic-release / changesets / bumpy convention", () => {
        expect(defaultTagFor("@scope/pkg", "1.2.3")).toBe("@scope/pkg@1.2.3");
        expect(defaultTagFor("plain", "0.0.1")).toBe("plain@0.0.1");
    });

    it("includes prerelease + build-metadata in tags", () => {
        expect(defaultTagFor("pkg", "1.0.0-alpha.0")).toBe("pkg@1.0.0-alpha.0");
        expect(defaultTagFor("pkg", "1.0.0+build.7")).toBe("pkg@1.0.0+build.7");
    });
});

describe("git: getCurrentBranch", () => {
    it("returns the trimmed branch name on success", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "alpha\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBe("alpha");
    });

    it("returns undefined for detached HEAD", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "HEAD\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });

    it("returns undefined for empty output", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 0, stderr: "", stdout: "\n" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });

    it("returns undefined on non-zero exit", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--abbrev-ref", "HEAD"], () => {
            return { exitCode: 128, stderr: "fatal", stdout: "" };
        });

        await expect(getCurrentBranch({ cwd: "/r", runner })).resolves.toBeUndefined();
    });
});

describe("git: getCurrentSha + getShortSha", () => {
    it("returns the trimmed sha on success", async () => {
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
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "HEAD"], () => {
            return { exitCode: 128, stderr: "fatal", stdout: "" };
        });

        await expect(getCurrentSha({ cwd: "/r", runner })).resolves.toBeUndefined();
    });
});

describe("git: hasUncommittedChanges", () => {
    it("returns true when porcelain output is non-empty", async () => {
        const runner = new MockRunner();

        runner.on("git", ["status", "--porcelain"], () => {
            return { exitCode: 0, stderr: "", stdout: " M foo.ts\n" };
        });

        await expect(hasUncommittedChanges({ cwd: "/r", runner })).resolves.toBe(true);
    });

    it("returns false when working tree is clean", async () => {
        const runner = new MockRunner();

        runner.on("git", ["status", "--porcelain"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await expect(hasUncommittedChanges({ cwd: "/r", runner })).resolves.toBe(false);
    });
});

describe("git: tagExists", () => {
    it("returns true when local tag exists", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--verify", "--quiet", "refs/tags/pkg@1.0.0"], () => {
            return { exitCode: 0, stderr: "", stdout: "abc1234" };
        });

        await expect(tagExists({ cwd: "/r", runner }, "pkg@1.0.0")).resolves.toBe(true);
    });

    it("returns false when local tag is missing", async () => {
        const runner = new MockRunner();

        runner.on("git", ["rev-parse", "--verify", "--quiet", "refs/tags/pkg@9.9.9"], () => {
            return { exitCode: 1, stderr: "", stdout: "" };
        });

        await expect(tagExists({ cwd: "/r", runner }, "pkg@9.9.9")).resolves.toBe(false);
    });
});

describe("git: tagExistsRemote", () => {
    it("returns true when remote tag exists", async () => {
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
        const runner = new MockRunner();

        runner.on("git", ["ls-remote", "--tags", "origin", "missing"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await expect(tagExistsRemote({ cwd: "/r", runner }, "missing")).resolves.toBe(false);
    });
});
