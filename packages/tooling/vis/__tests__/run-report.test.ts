import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import type { TaskResult } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import { compareDuration, formatTimingSummary } from "../src/run-report";

describe(formatTimingSummary, () => {
    it("should summarize 2 succeeded, 1 cached, 1 failed in 2400ms", () => {
        expect.assertions(4);

        const results = new Map<string, TaskResult>([
            [
                "app-a:build",
                {
                    status: "success",
                    task: { id: "app-a:build", outputs: [], overrides: {}, target: { project: "app-a", target: "build" } },
                },
            ],
            [
                "app-b:build",
                {
                    status: "success",
                    task: { id: "app-b:build", outputs: [], overrides: {}, target: { project: "app-b", target: "build" } },
                },
            ],
            [
                "app-a:test",
                {
                    status: "local-cache",
                    task: { id: "app-a:test", outputs: [], overrides: {}, target: { project: "app-a", target: "test" } },
                },
            ],
            [
                "app-b:test",
                {
                    status: "failure",
                    task: { id: "app-b:test", outputs: [], overrides: {}, target: { project: "app-b", target: "test" } },
                },
            ],
        ]);

        const output = formatTimingSummary(results, 2400);

        expect(output).toContain("2 succeeded");
        expect(output).toContain("1 cached");
        expect(output).toContain("1 failed");
        expect(output).toContain("2.4s");
    });
});

describe(compareDuration, () => {
    it("should report faster than average when current run is quicker", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-run-report-"));
        const runsDir = join(temporaryDirectory, ".task-runner", "runs");

        mkdirSync(runsDir, { recursive: true });

        writeFileSync(join(runsDir, "run-1.json"), JSON.stringify({ duration: 6000, startTime: "2026-01-01T00:00:00Z" }));
        writeFileSync(join(runsDir, "run-2.json"), JSON.stringify({ duration: 8000, startTime: "2026-01-02T00:00:00Z" }));
        writeFileSync(join(runsDir, "run-3.json"), JSON.stringify({ duration: 10_000, startTime: "2026-01-03T00:00:00Z" }));

        const result = compareDuration(temporaryDirectory, 2000);

        expect(result).toContain("faster than avg");
    });

    it("should return undefined when runs directory does not exist", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-run-report-"));

        expect(compareDuration(temporaryDirectory, 5000)).toBeUndefined();
    });
});
