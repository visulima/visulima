import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ChromeTraceEvent } from "../src/chrome-trace";
import { toChromeTrace, writeChromeTrace } from "../src/chrome-trace";
import type { RunSummary, TaskSummary } from "../src/run-summary";

const makeSummary = (tasks: TaskSummary[]): RunSummary => {
    return {
        duration: 10_000,
        endTime: new Date(1_700_000_010_000).toISOString(),
        environment: { arch: "x64", nodeVersion: "v22", platform: "linux" },
        id: "test-run",
        startTime: new Date(1_700_000_000_000).toISOString(),
        stats: { cached: 0, failed: 0, skipped: 0, succeeded: tasks.length, total: tasks.length },
        taskGraph: { dependencies: {}, roots: tasks.map((t) => t.taskId) },
        tasks,
    };
};

const makeTask = (id: string, startMs: number, endMs: number, dependencies: string[] = []): TaskSummary => {
    return {
        cacheable: true,
        cacheStatus: "MISS",
        dependencies,
        duration: endMs - startMs,
        endTime: new Date(1_700_000_000_000 + endMs).toISOString(),
        exitCode: 0,
        hash: `hash-${id}`,
        hashDetails: undefined,
        outputs: [],
        startTime: new Date(1_700_000_000_000 + startMs).toISOString(),
        target: { project: id.split(":")[0] ?? "app", target: id.split(":")[1] ?? "build" },
        taskId: id,
    };
};

describe(toChromeTrace, () => {
    it("emits one X event per task plus a metadata header", () => {
        expect.assertions(3);

        const events = toChromeTrace(makeSummary([makeTask("app:build", 0, 1000)]));
        const xEvents = events.filter((e) => e.ph === "X");

        expect(xEvents).toHaveLength(1);
        expect(xEvents[0]?.name).toBe("app:build");
        // Duration stored in microseconds (1000ms * 1000 = 1,000,000us)
        expect(xEvents[0]?.dur).toBe(1_000_000);
    });

    it("packs parallel tasks into separate lanes (tid)", () => {
        expect.assertions(2);

        // Two tasks running in parallel from 0–1000ms.
        const events = toChromeTrace(makeSummary([makeTask("a:build", 0, 1000), makeTask("b:build", 0, 1000)]));
        const xEvents = events.filter((e) => e.ph === "X");
        const lanes = new Set(xEvents.map((e) => e.tid));

        expect(xEvents).toHaveLength(2);
        expect(lanes.size).toBe(2);
    });

    it("reuses a lane when tasks are sequential", () => {
        expect.assertions(1);

        // Second task starts after first finishes — should reuse lane 0.
        const events = toChromeTrace(makeSummary([makeTask("a:build", 0, 500), makeTask("b:build", 500, 1000)]));
        const xLanes = events.filter((e) => e.ph === "X").map((e) => e.tid);

        expect(xLanes).toStrictEqual([0, 0]);
    });

    it("emits matching flow start/finish for dependencies", () => {
        expect.assertions(3);

        const tasks = [makeTask("lib:build", 0, 500), makeTask("app:build", 500, 1000, ["lib:build"])];
        const events = toChromeTrace(makeSummary(tasks));
        const starts = events.filter((e) => e.ph === "s");
        const finishes = events.filter((e) => e.ph === "f");

        expect(starts).toHaveLength(1);
        expect(finishes).toHaveLength(1);
        expect((starts[0] as ChromeTraceEvent).id).toBe((finishes[0] as ChromeTraceEvent).id);
    });

    it("skips tasks missing startTime or endTime", () => {
        expect.assertions(1);

        const incomplete: TaskSummary = {
            ...makeTask("app:build", 0, 1000),
            endTime: undefined,
        };

        const events = toChromeTrace(makeSummary([incomplete]));

        expect(events.filter((e) => e.ph === "X")).toHaveLength(0);
    });
});

describe(writeChromeTrace, () => {
    let workDir: string;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workDir = join(tmpdir(), `chrome-trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(workDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(workDir, { force: true, recursive: true });
    });

    it("writes a JSON file with traceEvents at the given path", async () => {
        expect.assertions(2);

        const outputPath = join(workDir, "trace.json");

        await writeChromeTrace(makeSummary([makeTask("app:build", 0, 100)]), outputPath);

        const content = await readFile(outputPath, "utf8");
        const parsed = JSON.parse(content) as { traceEvents: ChromeTraceEvent[] };

        expect(Array.isArray(parsed.traceEvents)).toBe(true);
        expect(parsed.traceEvents.some((e) => e.name === "app:build")).toBe(true);
    });
});
