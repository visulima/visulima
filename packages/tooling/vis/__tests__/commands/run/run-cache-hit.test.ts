import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter as pathDelimiter } from "node:path";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

interface LastRunSummary {
    stats: { cached: number; failed: number; skipped: number; succeeded: number; total: number };
    tasks: { cacheStatus: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED"; taskId: string }[];
}

const makeLogger = (): {
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    return {
        logger: {
            debug: () => undefined,
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
        },
    };
};

describe("vis run end-to-end cache hit", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-e2e-");
        originalPath = process.env["PATH"];

        // Scope PATH to a stub bin dir so the toolchain preflight cannot
        // shell out to corepack / mise / proto on the host. Even with
        // skipToolchain we keep this defensive — some upstream code paths
        // probe `which` independently. Prepend rather than replace: a
        // bare-`binDir` PATH on Windows leaves Node unable to resolve
        // cmd.exe / System32 paths the shell-spawn layer needs.
        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = `${binDir}${pathDelimiter}${process.env["PATH"] ?? ""}`;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const pkgDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@my/lib", scripts: { build: "echo hi" } }));
        // Project with a fast deterministic build target. `cache: true`
        // is the default for command targets, so a re-run with no input
        // change should be a cache hit.
        writeFileSync(
            join(pkgDir, "project.json"),
            JSON.stringify({
                targets: { build: { command: "echo hi", outputs: [] } },
            }),
        );
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("hits the cache on a re-run with unchanged inputs", async () => {
        // Two runs across one workspace + assertions on the persisted
        // last-run summary. The first run executes, the second hits the
        // local cache.
        expect.assertions(4);

        const { logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const firstSummary = JSON.parse(readFileSync(join(workspaceRoot, ".vis", "last-summary.json"), "utf8")) as LastRunSummary;

        expect(firstSummary.stats.total).toBe(1);
        expect(firstSummary.tasks[0]!.cacheStatus).toBe("MISS");

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const secondSummary = JSON.parse(readFileSync(join(workspaceRoot, ".vis", "last-summary.json"), "utf8")) as LastRunSummary;

        expect(secondSummary.stats.cached).toBeGreaterThanOrEqual(1);
        expect(secondSummary.tasks[0]!.cacheStatus).toBe("HIT");
    });

    it("invalidates the cache when a file behind a NAMED input changes", async () => {
        // Regression: the run handler must forward `config.namedInputs` (a
        // TOP-LEVEL config field, not part of `config.taskRunner`) into the
        // task-runner options. Without it the hasher gets an empty named-inputs
        // map, so a target whose `inputs` reference a named input (`production`
        // → `default` → `{projectRoot}/**/*`) resolves those names as literal,
        // non-existent directories — zero files in the cache key — and the task
        // false-cache-HITs forever, never re-running when a source file changes.
        expect.assertions(3);

        const { logger } = makeLogger();
        const pkgDir = join(workspaceRoot, "packages", "lib");
        const sourceFile = join(pkgDir, "src", "index.ts");

        mkdirSync(join(pkgDir, "src"), { recursive: true });
        writeFileSync(sourceFile, "export const a = 1;");
        // Build target keyed on a NAMED input (not the implicit fallback).
        writeFileSync(join(pkgDir, "project.json"), JSON.stringify({ targets: { build: { command: "echo hi", inputs: ["production"], outputs: [] } } }));

        const visConfig = {
            namedInputs: { default: ["{projectRoot}/**/*"], production: ["default"] },
            tasks: { build: { cache: true, inputs: ["production"] } },
        };

        const run = async (): Promise<LastRunSummary> => {
            await runExecute({
                argument: ["build"],
                logger,
                options: { cache: true, parallel: 1, skipToolchain: true },
                runtime: {} as never,
                visConfig,
                workspaceRoot,
            } as never);

            return JSON.parse(readFileSync(join(workspaceRoot, ".vis", "last-summary.json"), "utf8")) as LastRunSummary;
        };

        const first = await run();

        expect(first.tasks[0]!.cacheStatus).toBe("MISS");

        // Change a file that only the NAMED input covers, then re-run.
        writeFileSync(sourceFile, "export const a = 42;");

        const second = await run();

        // With `namedInputs` forwarded, the changed file busts the cache key.
        expect(second.tasks[0]!.cacheStatus).toBe("MISS");
        expect(second.stats.cached).toBe(0);
    });
});
