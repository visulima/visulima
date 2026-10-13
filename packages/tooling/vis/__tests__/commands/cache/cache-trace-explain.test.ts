import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TaskFingerprint } from "@visulima/task-runner";
import { Cache } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runHash, runWhy } from "../../../src/commands/cache/handler";

const createMockLogger = (): { info: (message: string) => void; lines: string[] } => {
    const lines: string[] = [];

    return {
        info: (message: string) => lines.push(message),
        lines,
    };
};

const writeLastSummary = (workspaceRoot: string, tasks: Record<string, unknown>[], id: string): void => {
    const dir = join(workspaceRoot, ".vis");

    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, "last-summary.json"),
        JSON.stringify({
            duration: 1000,
            endTime: new Date().toISOString(),
            environment: { arch: "x64", nodeVersion: "v22.0.0", platform: "linux" },
            id,
            startTime: new Date().toISOString(),
            stats: { cached: 0, failed: 0, skipped: 0, succeeded: 1, total: 1 },
            taskGraph: { dependencies: {}, roots: [] },
            tasks,
        }),
    );
};

const traceTask = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    return {
        cacheable: true,
        cacheStatus: "MISS",
        dependencies: [],
        duration: 100,
        endTime: new Date().toISOString(),
        exitCode: 0,
        hash: "traceHash",
        outputs: [],
        startTime: new Date().toISOString(),
        target: { project: "app", target: "build" },
        taskId: "app:build",
        ...overrides,
    };
};

describe("trace-mode cache explanations", () => {
    let workspaceRoot: string;
    let cacheDirectory: string;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-trace-"));
        cacheDirectory = join(workspaceRoot, "cache");
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        stdoutSpy.mockRestore();
        process.exitCode = 0;
    });

    it("cache why prints the recorded miss reasons for a trace-mode task", async () => {
        expect.assertions(2);

        writeLastSummary(
            workspaceRoot,
            [
                traceTask({
                    cacheMissReasons: [
                        { detail: "src/a.ts", type: "file-changed" },
                        { detail: "NODE_ENV", type: "env-changed" },
                    ],
                }),
            ],
            "run-1",
        );

        const logger = createMockLogger();

        await runWhy("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).toContain("File modified: src/a.ts");
        expect(text).toContain("Environment variable changed: NODE_ENV");
    });

    it("cache why JSON carries cacheMissReasons", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, [traceTask({ cacheMissReasons: [{ detail: "x", type: "file-deleted" }] })], "run-2");

        const logger = createMockLogger();

        await runWhy("app:build", { format: "json", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => String(call[0])).join("")) as { task: { cacheMissReasons: unknown } };

        expect(payload.task.cacheMissReasons).toStrictEqual([{ detail: "x", type: "file-deleted" }]);
    });

    it("cache hash reads the tracked files and env from the cache entry for the run hash", async () => {
        expect.assertions(4);

        const fingerprint: TaskFingerprint = {
            commandHash: "cmd",
            directoryListings: {},
            envHashes: { NODE_ENV: "envhash" },
            fileHashes: { "src/a.ts": "fileahash" },
            missingFiles: ["src/gone.ts"],
        };

        await new Cache({ cacheDirectory, workspaceRoot }).put("traceHash", "out", [], 0, fingerprint);

        writeLastSummary(workspaceRoot, [traceTask()], "run-3");

        const logger = createMockLogger();

        await runHash("app:build", { cacheDirectories: [cacheDirectory], format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const text = logger.lines.join("\n");

        expect(text).toContain("src/a.ts");
        expect(text).toContain("NODE_ENV");
        expect(text).toContain("src/gone.ts");
        expect(text).not.toContain("No hash details recorded");
    });

    it("cache hash says so when no cache entry holds the fingerprint", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, [traceTask()], "run-4");

        const logger = createMockLogger();

        await runHash("app:build", { cacheDirectories: [cacheDirectory], format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(logger.lines.join("\n")).not.toContain("tracked files");
    });

    it("cache why says which key a declared-fallback run was stored under", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, [traceTask({ hashSource: "declared-fallback" })], "run-5");

        const logger = createMockLogger();

        await runWhy("app:build", { format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(logger.lines.join("\n")).toContain("key:     declared-fallback");
    });

    it("cache why JSON carries hashSource", async () => {
        expect.assertions(1);

        writeLastSummary(workspaceRoot, [traceTask({ hashSource: "declared-fallback" })], "run-6");

        const logger = createMockLogger();

        await runWhy("app:build", { format: "json", runId: undefined, workspaceRoot }, logger as unknown as Console);

        const payload = JSON.parse(stdoutSpy.mock.calls.map((call) => String(call[0])).join("")) as { task: { hashSource: unknown } };

        expect(payload.task.hashSource).toBe("declared-fallback");
    });

    it("cache hash says the entry is keyed on the declared inputs for a declared-fallback run", async () => {
        expect.assertions(1);

        writeLastSummary(
            workspaceRoot,
            [traceTask({ hashDetails: { command: "build", implicitDeps: {}, nodes: { "packages/app/src/a.ts": "h" }, runtime: {} }, hashSource: "declared-fallback" })],
            "run-7",
        );

        const logger = createMockLogger();

        await runHash("app:build", { cacheDirectories: [cacheDirectory], format: "table", runId: undefined, workspaceRoot }, logger as unknown as Console);

        expect(logger.lines.join("\n")).toContain("key:     declared-fallback");
    });
});
