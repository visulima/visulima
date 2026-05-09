import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
        // probe `which` independently.
        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = binDir;

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
});
