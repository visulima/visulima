import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ciExecute from "../../../src/commands/ci/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): {
    calls: LoggerCall[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            debug: (...args) => calls.push(["debug", ...args]),
            error: (...args) => calls.push(["error", ...args]),
            info: (...args) => calls.push(["info", ...args]),
            warn: (...args) => calls.push(["warn", ...args]),
        },
    };
};

interface RuntimeCall {
    argv: string[];
    name: string;
}

const makeRuntime = (): { calls: RuntimeCall[]; runtime: { runCommand: (name: string, options: { argv: string[] }) => Promise<void> } } => {
    const calls: RuntimeCall[] = [];

    return {
        calls,
        runtime: {
            runCommand: async (name, options) => {
                calls.push({ argv: options.argv, name });
            },
        },
    };
};

describe("vis ci", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-ci-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const aDir = join(workspaceRoot, "packages", "a");

        mkdirSync(aDir, { recursive: true });
        writeFileSync(join(aDir, "package.json"), JSON.stringify({ name: "@my/a", scripts: { build: "tsc" } }));
        writeFileSync(join(aDir, "project.json"), JSON.stringify({ targets: { build: { command: "tsc" } } }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("throws when no targets are provided", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();
        const { runtime } = makeRuntime();

        await expect(
            ciExecute({
                argument: [],
                logger,
                options: { skipToolchain: true },
                runtime,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing targets/);
    });

    it("throws when targets resolve to an empty list", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();
        const { runtime } = makeRuntime();

        await expect(
            ciExecute({
                argument: [","],
                logger,
                options: { skipToolchain: true },
                runtime,
                visConfig: undefined,
                workspaceRoot,
            } as never),
        ).rejects.toThrow(/Missing targets/);
    });

    it("invokes install with --frozen-lockfile then affected for each target", async () => {
        expect.assertions(5);

        const { logger } = makeLogger();
        const { calls, runtime } = makeRuntime();

        await ciExecute({
            argument: ["lint,test"],
            logger,
            options: { skipToolchain: true },
            runtime,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(calls).toHaveLength(3);
        expect(calls[0]).toStrictEqual({ argv: ["--frozen-lockfile"], name: "install" });
        expect(calls[1]!.name).toBe("affected");
        expect(calls[1]!.argv).toContain("lint");
        expect(calls[2]!.argv).toContain("test");
    });

    it("skips install when --no-install is passed", async () => {
        expect.assertions(2);

        const { logger } = makeLogger();
        const { calls, runtime } = makeRuntime();

        await ciExecute({
            argument: ["build"],
            logger,
            options: { install: false, skipToolchain: true },
            runtime,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        expect(calls).toHaveLength(1);
        expect(calls[0]!.name).toBe("affected");
    });

    it("respects explicit --base and --head overrides", async () => {
        expect.assertions(2);

        const { logger } = makeLogger();
        const { calls, runtime } = makeRuntime();

        await ciExecute({
            argument: ["build"],
            logger,
            options: { base: "origin/develop", head: "feature/x", skipToolchain: true },
            runtime,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const affectedCall = calls.find((c) => c.name === "affected")!;

        expect(affectedCall.argv).toContain("--base=origin/develop");
        expect(affectedCall.argv).toContain("--head=feature/x");
    });

    it("auto-detects refs from GITHUB_BASE_REF / GITHUB_SHA", async () => {
        expect.assertions(2);

        const originalBase = process.env["GITHUB_BASE_REF"];
        const originalSha = process.env["GITHUB_SHA"];

        process.env["GITHUB_BASE_REF"] = "main";
        process.env["GITHUB_SHA"] = "abc123";

        try {
            const { logger } = makeLogger();
            const { calls, runtime } = makeRuntime();

            await ciExecute({
                argument: ["build"],
                logger,
                options: { skipToolchain: true },
                runtime,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const affectedCall = calls.find((c) => c.name === "affected")!;

            expect(affectedCall.argv).toContain("--base=origin/main");
            expect(affectedCall.argv).toContain("--head=abc123");
        } finally {
            if (originalBase === undefined) {
                delete process.env["GITHUB_BASE_REF"];
            } else {
                process.env["GITHUB_BASE_REF"] = originalBase;
            }

            if (originalSha === undefined) {
                delete process.env["GITHUB_SHA"];
            } else {
                process.env["GITHUB_SHA"] = originalSha;
            }
        }
    });

    it("auto-detects refs from BUILDKITE_PULL_REQUEST_BASE_BRANCH / BUILDKITE_COMMIT", async () => {
        expect.assertions(2);

        const originalBase = process.env["BUILDKITE_PULL_REQUEST_BASE_BRANCH"];
        const originalCommit = process.env["BUILDKITE_COMMIT"];
        const originalGhBase = process.env["GITHUB_BASE_REF"];
        const originalGitlabBase = process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"];

        // Higher-priority detectors (GH, GitLab) come first in the chain;
        // make sure neither is set so the Buildkite branch actually runs.
        delete process.env["GITHUB_BASE_REF"];
        delete process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"];
        process.env["BUILDKITE_PULL_REQUEST_BASE_BRANCH"] = "trunk";
        process.env["BUILDKITE_COMMIT"] = "deadbeef";

        try {
            const { logger } = makeLogger();
            const { calls, runtime } = makeRuntime();

            await ciExecute({
                argument: ["build"],
                logger,
                options: { skipToolchain: true },
                runtime,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const affectedCall = calls.find((c) => c.name === "affected")!;

            expect(affectedCall.argv).toContain("--base=origin/trunk");
            expect(affectedCall.argv).toContain("--head=deadbeef");
        } finally {
            if (originalBase === undefined) {
                delete process.env["BUILDKITE_PULL_REQUEST_BASE_BRANCH"];
            } else {
                process.env["BUILDKITE_PULL_REQUEST_BASE_BRANCH"] = originalBase;
            }

            if (originalCommit === undefined) {
                delete process.env["BUILDKITE_COMMIT"];
            } else {
                process.env["BUILDKITE_COMMIT"] = originalCommit;
            }

            if (originalGhBase !== undefined) {
                process.env["GITHUB_BASE_REF"] = originalGhBase;
            }

            if (originalGitlabBase !== undefined) {
                process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"] = originalGitlabBase;
            }
        }
    });

    it("forwards --upstream / --downstream / --parallel / --partition / --query when set", async () => {
        expect.assertions(4);

        const { logger } = makeLogger();
        const { calls, runtime } = makeRuntime();

        await ciExecute({
            argument: ["build"],
            logger,
            options: {
                downstream: "direct",
                parallel: 8,
                partition: "1/4",
                query: "tag=lib",
                skipToolchain: true,
                upstream: "deep",
            },
            runtime,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const affectedCall = calls.find((c) => c.name === "affected")!;

        expect(affectedCall.argv).toContain("--upstream=deep");
        expect(affectedCall.argv).toContain("--downstream=direct");
        expect(affectedCall.argv).toContain("--parallel=8");
        expect(affectedCall.argv).toContain("--partition=1/4");
    });
});
