import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunResult, ToolAdapter, ToolPresence } from "../../src/lint-fmt/config-types";
import type { AdapterJob } from "../../src/lint-fmt/runner";
import { runAdapter, runAdaptersParallel } from "../../src/lint-fmt/runner";

let workspaceRoot: string;
let scriptDir: string;

interface ScriptSpec {
    appendTo?: string;
    delayMs?: number;
    exitCode?: number;
    stdout?: string;
}

// Writes a tiny Node "tool" script so the runner can spawn it on every platform
// (bash scripts do not execute on Windows). Invoked via `node <script>`.
const writeScript = (name: string, spec: ScriptSpec): string => {
    const path = join(scriptDir, name);
    const lines: string[] = [];

    if (spec.appendTo !== undefined) {
        lines.push(`require("node:fs").appendFileSync(${JSON.stringify(spec.appendTo)}, ${JSON.stringify("run\n")});`);
    }

    if (spec.stdout !== undefined) {
        lines.push(`process.stdout.write(${JSON.stringify(`${spec.stdout}\n`)});`);
    }

    if (spec.delayMs === undefined) {
        lines.push(`process.exit(${String(spec.exitCode ?? 0)});`);
    } else {
        lines.push(`setTimeout(() => { process.exit(${String(spec.exitCode ?? 0)}); }, ${String(spec.delayMs)});`);
    }

    writeFileSync(path, lines.join("\n"));

    return path;
};

const stubAdapter = (id: string, scriptPath: string, extra: Partial<ToolAdapter> = {}): ToolAdapter => {
    return {
        argsCheck: () => ["check"],
        argsFix: () => ["fix"],
        bin: () => ["node", scriptPath],
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

const stubPresence = (): ToolPresence => {
    return { adapter: "oxlint", declared: false, root: workspaceRoot };
};

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

            const a = writeScript("a.cjs", { stdout: "from-a" });
            const b = writeScript("b.cjs", { stdout: "from-b" });
            const c = writeScript("c.cjs", { stdout: "from-c" });

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

            const fail = writeScript("fail.cjs", { exitCode: 7, stdout: "bye" });
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
                const a = writeScript("a.cjs", { stdout: "one" });
                const b = writeScript("b.cjs", { stdout: "two" });

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

            const sleepy = writeScript("slow.cjs", { delayMs: 300 });
            const makeJobs = (): AdapterJob[] =>
                Array.from({ length: 4 }, (_, index) => {
                    return {
                        adapter: stubAdapter(`stub-${index}`, sleepy),
                        files: ["."],
                        presence: stubPresence(),
                    };
                });

            // Measure a forced-serial baseline (VIS_LINT_FMT_SERIAL=1) and the
            // parallel run, then assert a *relative* speedup. An absolute
            // wall-clock ceiling flakes on loaded CI/dev machines (process
            // spawn cost + CPU contention scale both runs); a ratio stays
            // meaningful because both halves absorb the same jitter.
            const previous = process.env.VIS_LINT_FMT_SERIAL;

            process.env.VIS_LINT_FMT_SERIAL = "1";

            let serialDuration: number;

            try {
                const serialStart = Date.now();

                await runAdaptersParallel(makeJobs(), {}, "check", 4);

                serialDuration = Date.now() - serialStart;
            } finally {
                if (previous === undefined) {
                    delete process.env.VIS_LINT_FMT_SERIAL;
                } else {
                    process.env.VIS_LINT_FMT_SERIAL = previous;
                }
            }

            const parallelStart = Date.now();

            await runAdaptersParallel(makeJobs(), {}, "check", 4);

            const parallelDuration = Date.now() - parallelStart;

            // 4 × 300ms jobs: serial ≈ 1200ms+, parallel ≈ one job + overhead.
            // Require a clear speedup (parallel under 70% of serial) without
            // pinning an absolute budget.
            expect(parallelDuration).toBeLessThan(serialDuration * 0.7);
        });
    });

    describe(runAdapter, () => {
        it("runs synchronously and reports stdout / exit code", () => {
            expect.assertions(2);

            const script = writeScript("hello.cjs", { stdout: "hi" });
            const result: RunResult = runAdapter(stubAdapter("oxlint", script), stubPresence(), ["."], {}, "check");

            expect(result.stdout.trim()).toBe("hi");
            expect(result.exitCode).toBe(0);
        });
    });

    describe("cache integration", () => {
        it("serves a stored RunResult on a hit and skips the spawn", async () => {
            expect.assertions(3);

            const cacheRoot = mkdtempSync(join(tmpdir(), "vis-runner-cache-"));
            const sourceFile = join(workspaceRoot, "a.ts");

            writeFileSync(sourceFile, "export const a = 1;");

            // Counter script: each invocation appends a line. After two
            // calls we know the second hit short-circuited if the file
            // still has one line.
            const counterFile = join(scriptDir, "count.log");
            const counter = writeScript("counter.cjs", { appendTo: counterFile, stdout: "hit" });

            const presence: ToolPresence = { adapter: "oxlint", declared: false, root: workspaceRoot };
            const adapter = stubAdapter("oxlint", counter, { cacheKey: () => "stable" });
            const jobs: AdapterJob[] = [{ adapter, files: [sourceFile], presence }];

            try {
                const first = await runAdaptersParallel(jobs, {}, "check", { cacheRoot });
                const second = await runAdaptersParallel(jobs, {}, "check", { cacheRoot });

                expect(first[0]!.stdout).toContain("hit");
                expect(second[0]!.stdout).toContain("hit");

                const log = readFileSync(counterFile, "utf8").trim().split("\n");

                expect(log).toHaveLength(1);
            } finally {
                rmSync(cacheRoot, { force: true, recursive: true });
            }
        });

        it("re-runs after file contents change", async () => {
            expect.assertions(1);

            const cacheRoot = mkdtempSync(join(tmpdir(), "vis-runner-cache-"));
            const sourceFile = join(workspaceRoot, "a.ts");

            writeFileSync(sourceFile, "export const a = 1;");

            const counterFile = join(scriptDir, "count2.log");
            const counter = writeScript("counter2.cjs", { appendTo: counterFile, stdout: "ok" });

            const presence: ToolPresence = { adapter: "oxlint", declared: false, root: workspaceRoot };
            const adapter = stubAdapter("oxlint", counter, { cacheKey: () => "stable" });
            const jobs: AdapterJob[] = [{ adapter, files: [sourceFile], presence }];

            try {
                await runAdaptersParallel(jobs, {}, "check", { cacheRoot });
                writeFileSync(sourceFile, "export const a = 2;");
                await runAdaptersParallel(jobs, {}, "check", { cacheRoot });

                const log = readFileSync(counterFile, "utf8").trim().split("\n");

                expect(log).toHaveLength(2);
            } finally {
                rmSync(cacheRoot, { force: true, recursive: true });
            }
        });

        it("bypasses the cache for `.` workspace runs", async () => {
            expect.assertions(1);

            const cacheRoot = mkdtempSync(join(tmpdir(), "vis-runner-cache-"));

            const counterFile = join(scriptDir, "count3.log");
            const counter = writeScript("counter3.cjs", { appendTo: counterFile, stdout: "ok" });

            const presence: ToolPresence = { adapter: "oxlint", declared: false, root: workspaceRoot };
            const adapter = stubAdapter("oxlint", counter, { cacheKey: () => "stable" });
            const jobs: AdapterJob[] = [{ adapter, files: ["."], presence }];

            try {
                await runAdaptersParallel(jobs, {}, "check", { cacheRoot });
                await runAdaptersParallel(jobs, {}, "check", { cacheRoot });

                const log = readFileSync(counterFile, "utf8").trim().split("\n");

                expect(log).toHaveLength(2);
            } finally {
                rmSync(cacheRoot, { force: true, recursive: true });
            }
        });
    });
});
