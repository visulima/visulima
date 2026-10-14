import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// One package whose command appends to a counter file, so every real execution
// is visible and a cache hit leaves the count unchanged.
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
    writeFileSync(join(packageDir, "count.cjs"), `require("node:fs").appendFileSync(${JSON.stringify(join(workspaceRoot, "count.txt"))}, "x");\n`);
    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: { build: { command: "node count.cjs", fingerprintEnv: ["VIS_TEST_*"], outputs: [], untrackedEnv: ["VIS_TEST_UNTRACKED"] } },
        }),
    );
};

describe("vis run per-target env cache key", () => {
    let workspaceRoot: string;
    const saved = { ...process.env };

    const executions = (): number => {
        try {
            return readFileSync(join(workspaceRoot, "count.txt"), "utf8").length;
        } catch {
            return 0;
        }
    };

    const run = async (env: Record<string, string>): Promise<number> => {
        for (const [key, value] of Object.entries(env)) {
            process.env[key] = value;
        }

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: true, cacheDir: join(workspaceRoot, ".cache"), parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return executions();
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-env-key-");
        seedWorkspace(workspaceRoot);
    });

    afterEach(() => {
        process.env = { ...saved };
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("re-runs when a fingerprintEnv variable changes and ignores untrackedEnv changes", async () => {
        expect.assertions(4);

        await expect(run({ VIS_TEST_TRACKED: "a", VIS_TEST_UNTRACKED: "1" })).resolves.toBe(1);
        await expect(run({ VIS_TEST_TRACKED: "a", VIS_TEST_UNTRACKED: "1" })).resolves.toBe(1);
        // fingerprintEnv: a tracked variable changed, so the cache key changed.
        await expect(run({ VIS_TEST_TRACKED: "b" })).resolves.toBe(2);
        // untrackedEnv wins over the VIS_TEST_* pattern: still a cache hit.
        await expect(run({ VIS_TEST_UNTRACKED: "2" })).resolves.toBe(2);
    });
});
