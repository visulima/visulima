import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
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

// Three-package workspace covering each runner-tag eligibility case:
// - `@my/gpu` declares `runnerTags: ["gpu"]` (capability-tagged)
// - `@my/slow` declares `runnerTags: ["slow"]` (different capability)
// - `@my/general` has no runnerTags (always eligible)
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const gpuDir = join(workspaceRoot, "packages", "gpu");
    const slowDir = join(workspaceRoot, "packages", "slow");
    const generalDir = join(workspaceRoot, "packages", "general");

    mkdirSync(gpuDir, { recursive: true });
    mkdirSync(slowDir, { recursive: true });
    mkdirSync(generalDir, { recursive: true });

    writeFileSync(join(gpuDir, "package.json"), JSON.stringify({ name: "@my/gpu" }));
    writeFileSync(
        join(gpuDir, "project.json"),
        JSON.stringify({ targets: { test: { command: "echo gpu", options: { runnerTags: ["gpu"] } } } }),
    );

    writeFileSync(join(slowDir, "package.json"), JSON.stringify({ name: "@my/slow" }));
    writeFileSync(
        join(slowDir, "project.json"),
        JSON.stringify({ targets: { test: { command: "echo slow", options: { runnerTags: ["slow"] } } } }),
    );

    writeFileSync(join(generalDir, "package.json"), JSON.stringify({ name: "@my/general" }));
    writeFileSync(
        join(generalDir, "project.json"),
        JSON.stringify({ targets: { test: { command: "echo general" } } }),
    );
};

const collectInfoText = (calls: LoggerCall[]): string =>
    calls
        .filter((c) => c[0] === "info")
        .map((c) => c.slice(1).join(" "))
        .join("\n");

describe("vis run --runner-tags", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;
    let originalRunnerTags: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-runner-tags-");
        originalPath = process.env["PATH"];
        originalRunnerTags = process.env["VIS_RUNNER_TAGS"];

        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = binDir;
        delete process.env["VIS_RUNNER_TAGS"];

        seedWorkspace(workspaceRoot);
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        if (originalRunnerTags === undefined) {
            delete process.env["VIS_RUNNER_TAGS"];
        } else {
            process.env["VIS_RUNNER_TAGS"] = originalRunnerTags;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("includes every project when neither flag nor env is set (back-compat)", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/gpu:test");
        expect(text).toContain("@my/slow:test");
        expect(text).toContain("@my/general:test");
    });

    it("keeps only matching tagged tasks plus untagged tasks when --runner-tags=gpu", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, runnerTags: "gpu", skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/gpu:test");
        expect(text).toContain("@my/general:test");
        // `@my/slow` declared `runnerTags: ["slow"]` — runner only advertises
        // `gpu`, so the task must be filtered out.
        expect(text).not.toContain("@my/slow:test");
    });

    it("falls back to the VIS_RUNNER_TAGS env var when no flag is provided", async () => {
        expect.assertions(3);

        process.env["VIS_RUNNER_TAGS"] = "slow";

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/slow:test");
        expect(text).toContain("@my/general:test");
        expect(text).not.toContain("@my/gpu:test");
    });

    it("prefers the CLI flag over VIS_RUNNER_TAGS when both are present", async () => {
        expect.assertions(3);

        // env says `slow` but flag says `gpu` — flag wins so a script can
        // override a CI-injected default without unsetting the env.
        process.env["VIS_RUNNER_TAGS"] = "slow";

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, runnerTags: "gpu", skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/gpu:test");
        expect(text).toContain("@my/general:test");
        expect(text).not.toContain("@my/slow:test");
    });

    it("treats a comma-separated tag list as the union of capabilities", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            options: { cache: false, dryRun: true, parallel: 1, runnerTags: "gpu,slow", skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/gpu:test");
        expect(text).toContain("@my/slow:test");
        expect(text).toContain("@my/general:test");
    });

    it("ignores empty and whitespace-only tags so `--runner-tags=` does not enable a phantom filter", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["test"],
            logger,
            // `,, ,` collapses to an empty Set after filter(Boolean) — must
            // behave the same as not passing the flag at all.
            options: { cache: false, dryRun: true, parallel: 1, runnerTags: ",, ,", skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = collectInfoText(calls);

        expect(text).toContain("@my/gpu:test");
        expect(text).toContain("@my/slow:test");
        expect(text).toContain("@my/general:test");
    });
});
