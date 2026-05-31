import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunResult, ToolAdapter, ToolPresence } from "../../src/lint-fmt/config-types";
import type { AdapterJob } from "../../src/lint-fmt/runner";
import { runAdapter, runAdaptersParallel } from "../../src/lint-fmt/runner";

let workspaceRoot: string;
let scriptDir: string;

const writeScript = (name: string, body: string): string => {
    const path = join(scriptDir, name);

    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
    chmodSync(path, 0o755);

    return path;
};

const stubAdapter = (id: string, scriptPath: string, extra: Partial<ToolAdapter> = {}): ToolAdapter => {
    return {
        argsCheck: () => ["check"],
        argsFix: () => ["fix"],
        bin: () => [scriptPath],
        cacheKey: () => "",
        detect: () => undefined,
        extensions: ["ts"],
        // The id field is typed as AdapterId (union of literals). Tests use stand-in
        // ids; the runner only treats them as strings so casting is safe.
        id: id as ToolAdapter["id"],
        kind: "lint",
        parse: () => [],
        ...extra,
    };
};

const stubPresence = (): ToolPresence => { return { adapter: "oxlint", declared: false, root: workspaceRoot }; };

describe("lint-fmt runner", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-runner-"));
        scriptDir = mkdtempSync(join(tmpdir(), "vis-runner-bin-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
        rmSync(scriptDir, { force: true, recursive: true });
    });

    describe(runAdaptersParallel, () => {
        it("returns results in input job order", async () => {
            expect.assertions(4);

            const a = writeScript("a.sh", "echo from-a");
            const b = writeScript("b.sh", "echo from-b");
            const c = writeScript("c.sh", "echo from-c");

            const jobs: AdapterJob[] = [
                { adapter: stubAdapter("oxlint", a), files: ["."], presence: stubPresence() },
                { adapter: stubAdapter("eslint", b), files: ["."], presence: stubPresence() },
                { adapter: stubAdapter("biome", c), files: ["."], presence: stubPresence() },
            ];

            const results = await runAdaptersParallel(jobs, {}, "check");

            expect(results).toHaveLength(3);
            expect(results[0]!.stdout).toContain("from-a");
            expect(results[1]!.stdout).toContain("from-b");
            expect(results[2]!.stdout).toContain("from-c");
        });

        it("captures non-zero exit codes", async () => {
            expect.assertions(2);

            const fail = writeScript("fail.sh", "echo bye; exit 7");
            const jobs: AdapterJob[] = [{ adapter: stubAdapter("eslint", fail), files: ["."], presence: stubPresence() }];

            const [result] = await runAdaptersParallel(jobs, {}, "check");

            expect(result!.exitCode).toBe(7);
            expect(result!.stdout.trim()).toBe("bye");
        });

        it("returns an empty array when given no jobs", async () => {
            expect.assertions(1);

            await expect(runAdaptersParallel([], {}, "check")).resolves.toStrictEqual([]);
        });

        it("falls back to sequential when VIS_LINT_FMT_SERIAL=1", async () => {
            expect.assertions(2);

            const previous = process.env.VIS_LINT_FMT_SERIAL;

            process.env.VIS_LINT_FMT_SERIAL = "1";

            try {
                const a = writeScript("a.sh", "echo one");
                const b = writeScript("b.sh", "echo two");

                const jobs: AdapterJob[] = [
                    { adapter: stubAdapter("oxlint", a), files: ["."], presence: stubPresence() },
                    { adapter: stubAdapter("eslint", b), files: ["."], presence: stubPresence() },
                ];

                const results = await runAdaptersParallel(jobs, {}, "check");

                expect(results[0]!.stdout).toContain("one");
                expect(results[1]!.stdout).toContain("two");
            } finally {
                if (previous === undefined) {
                    delete process.env.VIS_LINT_FMT_SERIAL;
                } else {
                    process.env.VIS_LINT_FMT_SERIAL = previous;
                }
            }
        });

        it("delivers parallel speedup vs sequential", async () => {
            expect.assertions(1);

            const sleepy = writeScript("slow.sh", "sleep 0.3");

            const jobs: AdapterJob[] = Array.from({ length: 4 }, (_, index) => {
                return {
                    adapter: stubAdapter(`stub-${index}`, sleepy),
                    files: ["."],
                    presence: stubPresence(),
                };
            });

            const start = Date.now();

            await runAdaptersParallel(jobs, {}, "check", 4);

            const parallelDuration = Date.now() - start;

            // Sequential would be 4 × 300ms = ~1200ms. Allow 700ms ceiling for
            // CI jitter while still proving real parallelism.
            expect(parallelDuration).toBeLessThan(700);
        });
    });

    describe(runAdapter, () => {
        it("runs synchronously and reports stdout / exit code", () => {
            expect.assertions(2);

            const script = writeScript("hello.sh", "echo hi");
            const result: RunResult = runAdapter(stubAdapter("oxlint", script), stubPresence(), ["."], {}, "check");

            expect(result.stdout.trim()).toBe("hi");
            expect(result.exitCode).toBe(0);
        });
    });
});
