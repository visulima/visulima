import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import statusExecute from "../../../src/commands/status/handler";
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

describe("vis status", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-status-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const aDir = join(workspaceRoot, "packages", "a");
        const bDir = join(workspaceRoot, "packages", "b");

        mkdirSync(aDir, { recursive: true });
        mkdirSync(bDir, { recursive: true });

        writeFileSync(join(aDir, "package.json"), JSON.stringify({ name: "@my/a", scripts: { build: "tsc" } }));
        writeFileSync(join(aDir, "project.json"), JSON.stringify({ targets: { build: { command: "tsc" } } }));

        writeFileSync(join(bDir, "package.json"), JSON.stringify({ name: "@my/b", scripts: { test: "vitest" } }));
        writeFileSync(join(bDir, "project.json"), JSON.stringify({ targets: { test: { command: "vitest" } } }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("emits a JSON shape with the expected fields", async () => {
        expect.assertions(6);

        const { calls, logger } = makeLogger();

        await statusExecute({
            argument: [],
            logger,
            options: { json: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as {
            cacheHitRate: string | null;
            constraintViolations: number;
            flakyTasks: number;
            projects: number;
            runtimeIssues: number;
            targets: number;
        };

        expect(parsed.projects).toBe(2);
        expect(parsed.targets).toBe(2);
        expect(parsed.constraintViolations).toBe(0);
        expect(parsed.flakyTasks).toBe(0);
        expect(parsed.cacheHitRate).toBeNull();
        expect(Number.isInteger(parsed.runtimeIssues)).toBe(true);
    });

    it("computes cache hit rate when run summaries are present", async () => {
        expect.assertions(1);

        const runsDir = join(workspaceRoot, ".vis", "runs");

        mkdirSync(runsDir, { recursive: true });

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify({ stats: { cached: 3, total: 4 } }));
        writeFileSync(join(runsDir, "run-2.json"), JSON.stringify({ stats: { cached: 5, total: 6 } }));

        const { calls, logger } = makeLogger();

        await statusExecute({
            argument: [],
            logger,
            options: { json: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as { cacheHitRate: string };

        expect(parsed.cacheHitRate).toBe("80%");
    });

    it("renders an ASCII status block when --json is not passed", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await statusExecute({
            argument: [],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("VIS STATUS");
        expect(text).toContain("2 projects");
    });
});
