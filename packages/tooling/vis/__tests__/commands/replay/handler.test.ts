import { mkdir, writeFile } from "node:fs/promises";

import { join } from "@visulima/path";
import type { RunSummary } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { replayExecute } from "../../../src/commands/replay/handler";
import { pail } from "../../../src/io/logger";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

interface ToolboxShape {
    argument: string[];
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    visConfig: Record<string, unknown> | undefined;
    workspaceRoot: string | undefined;
}

const buildToolbox = (overrides: Partial<ToolboxShape> = {}): ToolboxShape => ({
    argument: [],
    logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
    options: {},
    visConfig: undefined,
    workspaceRoot: "/tmp/replay-not-used",
    ...overrides,
});

const buildSummary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
    duration: 1234,
    endTime: "2026-05-04T12:34:56.789Z",
    environment: { arch: "x64", nodeVersion: "v22.14.0", platform: "linux" },
    id: "2026-05-04T12-34-56-789Z_abc123",
    startTime: "2026-05-04T12:34:55.555Z",
    stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
    taskGraph: { dependencies: { "@app:test": [] }, roots: ["@app:test"] },
    tasks: [
        {
            cacheable: true,
            cacheStatus: "MISS",
            dependencies: [],
            duration: 234,
            endTime: "2026-05-04T12:34:55.789Z",
            exitCode: 0,
            hash: "abcdef0123456789aabbccdd",
            hashDetails: undefined,
            outputs: [],
            startTime: "2026-05-04T12:34:55.555Z",
            target: { project: "@app", target: "test" },
            taskId: "@app:test",
        },
    ],
    ...overrides,
});

const writeSummary = async (workspaceRoot: string, summary: RunSummary, kind: "last" | "run" = "run"): Promise<void> => {
    const directory = kind === "last" ? join(workspaceRoot, ".task-runner") : join(workspaceRoot, ".task-runner", "runs");

    await mkdir(directory, { recursive: true });

    const filename = kind === "last" ? "last-summary.json" : `${summary.id}.json`;

    await writeFile(join(directory, filename), JSON.stringify(summary));
};

describe("commands/replay/handler", () => {
    let workspaceRoot: string;
    let originalExitCode: number | string | undefined;
    let pailErrorSpy: ReturnType<typeof vi.spyOn>;
    let pailInfoSpy: ReturnType<typeof vi.spyOn>;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-replay-ws-");
        originalExitCode = process.exitCode;
        process.exitCode = 0;
        pailErrorSpy = vi.spyOn(pail, "error").mockImplementation(() => undefined as never);
        pailInfoSpy = vi.spyOn(pail, "info").mockImplementation(() => undefined as never);
        stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        cleanupTemporaryDirectory(workspaceRoot);
        vi.restoreAllMocks();
    });

    describe("loading", () => {
        it("errors when no last-summary exists and no run id was passed", async () => {
            expect.assertions(2);

            await replayExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("No previous run summary"));
        });

        it("loads the last-summary file by default", async () => {
            expect.assertions(2);

            const summary = buildSummary();

            await writeSummary(workspaceRoot, summary, "last");

            const toolbox = buildToolbox({ workspaceRoot });

            await replayExecute(toolbox as never);

            expect(process.exitCode).toBe(0);
            expect(toolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining(summary.id));
        });

        it("loads a specific run id from .task-runner/runs/", async () => {
            expect.assertions(1);

            const summary = buildSummary({ id: "specific-run-id" });

            await writeSummary(workspaceRoot, summary, "run");

            const toolbox = buildToolbox({ options: { run: "specific-run-id" }, workspaceRoot });

            await replayExecute(toolbox as never);

            expect(toolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("specific-run-id"));
        });

        it("errors with a clear message when the requested run id is missing", async () => {
            expect.assertions(2);

            await replayExecute(buildToolbox({ options: { run: "no-such-run" }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("\"no-such-run\""));
        });
    });

    describe("--list", () => {
        it("reports an empty workspace as having no recorded runs", async () => {
            expect.assertions(1);

            await replayExecute(buildToolbox({ options: { list: true }, workspaceRoot }) as never);

            expect(pailInfoSpy).toHaveBeenCalledWith(expect.stringContaining("No recorded runs"));
        });

        it("renders newest-first by mtime in --list output", async () => {
            expect.assertions(1);

            const older = buildSummary({ id: "older-run-id" });
            const newer = buildSummary({ id: "newer-run-id" });

            await writeSummary(workspaceRoot, older, "run");
            // Force "newer" to actually have a newer mtime by writing later.
            await new Promise((resolve) => {
                setTimeout(resolve, 20);
            });
            await writeSummary(workspaceRoot, newer, "run");

            const toolbox = buildToolbox({ options: { list: true }, workspaceRoot });

            await replayExecute(toolbox as never);

            const lines = (toolbox.logger.info as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as string);
            const newerIndex = lines.findIndex((line) => line.includes("newer-run-id"));
            const olderIndex = lines.findIndex((line) => line.includes("older-run-id"));

            // newer must appear above older in the rendered table
            expect(newerIndex).toBeLessThan(olderIndex);
        });

        it("emits a JSON array under --list --format=json", async () => {
            expect.assertions(2);

            const summary = buildSummary({ id: "json-listed-run" });

            await writeSummary(workspaceRoot, summary, "run");

            await replayExecute(buildToolbox({ options: { format: "json", list: true }, workspaceRoot }) as never);

            const written = (stdoutSpy.mock.calls[0]?.[0] as string) ?? "";
            const parsed = JSON.parse(written) as { id: string }[];

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0]?.id).toBe("json-listed-run");
        });
    });

    describe("filters", () => {
        it("--task=X errors when the task is not present in the run", async () => {
            expect.assertions(2);

            await writeSummary(workspaceRoot, buildSummary(), "last");

            await replayExecute(buildToolbox({ options: { task: "@app:nonexistent" }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("@app:nonexistent"));
        });

        it("--task=X renders the focused task detail with a vis cache why hint", async () => {
            expect.assertions(2);

            await writeSummary(workspaceRoot, buildSummary(), "last");

            const toolbox = buildToolbox({ options: { task: "@app:test" }, workspaceRoot });

            await replayExecute(toolbox as never);

            // pail.info carries the actionable next-step hint.
            expect(pailInfoSpy).toHaveBeenCalledWith(expect.stringMatching(/vis cache why @app:test/));
            expect(toolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("Task @app:test"));
        });

        it("--failed filters to non-zero-exit tasks", async () => {
            expect.assertions(1);

            const summary = buildSummary({
                stats: { cached: 0, failed: 1, skipped: 0, succeeded: 1, total: 2 },
                tasks: [
                    {
                        cacheable: true,
                        cacheStatus: "MISS",
                        dependencies: [],
                        duration: 100,
                        endTime: undefined,
                        exitCode: 0,
                        hash: undefined,
                        hashDetails: undefined,
                        outputs: [],
                        startTime: undefined,
                        target: { project: "@app", target: "ok" },
                        taskId: "@app:ok",
                    },
                    {
                        cacheable: true,
                        cacheStatus: "MISS",
                        dependencies: [],
                        duration: 50,
                        endTime: undefined,
                        exitCode: 1,
                        hash: undefined,
                        hashDetails: undefined,
                        outputs: [],
                        startTime: undefined,
                        target: { project: "@app", target: "broken" },
                        taskId: "@app:broken",
                    },
                ],
            });

            await writeSummary(workspaceRoot, summary, "last");

            await replayExecute(buildToolbox({ options: { failed: true, format: "json" }, workspaceRoot }) as never);

            const written = (stdoutSpy.mock.calls[0]?.[0] as string) ?? "";
            const parsed = JSON.parse(written) as { tasks: { taskId: string }[] };

            expect(parsed.tasks.map((t) => t.taskId)).toEqual(["@app:broken"]);
        });
    });

    describe("exit code", () => {
        it("propagates a non-zero exit code when the run had failed tasks", async () => {
            expect.assertions(1);

            const summary = buildSummary({
                stats: { cached: 0, failed: 1, skipped: 0, succeeded: 0, total: 1 },
                tasks: [
                    {
                        cacheable: true,
                        cacheStatus: "MISS",
                        dependencies: [],
                        duration: 50,
                        endTime: undefined,
                        exitCode: 1,
                        hash: undefined,
                        hashDetails: undefined,
                        outputs: [],
                        startTime: undefined,
                        target: { project: "@app", target: "boom" },
                        taskId: "@app:boom",
                    },
                ],
            });

            await writeSummary(workspaceRoot, summary, "last");

            await replayExecute(buildToolbox({ workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
        });
    });

    describe("--format validation", () => {
        it("rejects an invalid --format value", async () => {
            expect.assertions(2);

            await replayExecute(buildToolbox({ options: { format: "yaml" }, workspaceRoot }) as never);

            expect(process.exitCode).toBe(1);
            expect(pailErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid --format"));
        });
    });
});
