import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { strip } from "@visulima/colorize";
import type { Task, TaskResult } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskStore } from "../../../src/tui/components/task-store";

const task = (id: string): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: id.split(":")[0]!, target: id.split(":")[1] ?? "build" },
    };
};

const result = (t: Task, status: TaskResult["status"], terminalOutput: string): TaskResult => {
    return {
        code: status === "failure" ? 1 : 0,
        endTime: 2000,
        startTime: 1000,
        status,
        task: t,
        terminalOutput,
    };
};

describe("tui/TaskStore failure-render wiring", () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vis-store-"));
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("stores a failure's terminal output verbatim — the failure block is rendered lazily by the consumer", () => {
        expect.assertions(2);

        const file = join(dir, "boom.js");

        writeFileSync(file, "const a = 1;\nthrow new TypeError('store boom');\n");

        const t = task("app:build");
        const store = new TaskStore([t]);

        const raw = ["> runner", "", "TypeError: store boom", `    at run (${file}:2:7)`].join("\n");

        store.endTasks([result(t, "failure", raw)]);

        const stored = store.getSnapshot().outputs.get("app:build") ?? "";

        expect(strip(stored)).toBe(raw);
        // Sanity check: the store doesn't pre-render the failure block.
        expect(stored).not.toContain("✖");
    });

    it("preserves streamed output when the failure result carries none", () => {
        expect.assertions(1);

        const file = join(dir, "stream.js");

        writeFileSync(file, "throw new Error('streamed');\n");

        const t = task("app:test");
        const store = new TaskStore([t]);

        // Output arrived incrementally before the result; the result itself
        // has an empty terminalOutput. endTasks must keep the stream intact.
        const streamed = ["Error: streamed", `    at x (${file}:1:7)`].join("\n");

        store.addOutput("app:test", streamed);
        store.endTasks([result(t, "failure", "")]);

        expect(strip(store.getSnapshot().outputs.get("app:test") ?? "")).toBe(streamed);
    });

    it("stores non-failure output verbatim without rendering", () => {
        expect.assertions(2);

        const t = task("app:lint");
        const store = new TaskStore([t]);

        store.endTasks([result(t, "success", "all good\n")]);

        const stored = store.getSnapshot().outputs.get("app:lint");

        expect(stored).toBe("all good\n");
        expect(stored).not.toContain("✖");
    });

    it("does not overwrite already-streamed output for a non-failure result", () => {
        expect.assertions(1);

        const t = task("app:dev");
        const store = new TaskStore([t]);

        store.addOutput("app:dev", "streamed line\n");
        store.endTasks([result(t, "success", "result line\n")]);

        expect(store.getSnapshot().outputs.get("app:dev")).toBe("streamed line\n");
    });
});

describe("tui/TaskStore graph-scoped counters", () => {
    it("defaults totalTasks to the row count when no graph size is supplied", () => {
        expect.assertions(1);

        const store = new TaskStore([task("a:build"), task("b:build")]);

        expect(store.getSnapshot().totalTasks).toBe(2);
    });

    it("reports the full executed-graph size as totalTasks even when fewer tasks are rendered as rows", () => {
        expect.assertions(2);

        // One requested row, but the graph also runs two dependsOn deps.
        const store = new TaskStore([task("app:lint")], 3);
        const snapshot = store.getSnapshot();

        expect(snapshot.totalTasks).toBe(3);
        expect(snapshot.rows).toHaveLength(1);
    });

    it("counts dependency tasks toward succeeded without adding rows", () => {
        expect.assertions(3);

        const requested = task("app:lint");
        const dep = task("lib:build");
        const store = new TaskStore([requested], 2);

        store.startTasks([requested, dep]);
        store.endTasks([result(requested, "success", ""), result(dep, "success", "")]);

        const snapshot = store.getSnapshot();

        // Both the requested task and its dep count toward the tally...
        expect(snapshot.succeeded).toBe(2);
        // ...but only the requested task is rendered as a row.
        expect(snapshot.rows).toHaveLength(1);
        // succeeded now matches totalTasks — the mismatch this fixes.
        expect(snapshot.succeeded).toBe(snapshot.totalTasks);
    });

    it("tracks in-flight tasks via running across the whole graph", () => {
        expect.assertions(3);

        const requested = task("app:lint");
        const dep = task("lib:build");
        const store = new TaskStore([requested], 2);

        store.startTasks([requested, dep]);

        expect(store.getSnapshot().running).toBe(2);

        store.endTasks([result(dep, "local-cache", "")]);

        expect(store.getSnapshot().running).toBe(1);

        store.endTasks([result(requested, "success", "")]);

        expect(store.getSnapshot().running).toBe(0);
    });

    it("clamps running at zero when a result arrives without a matching start (cache hits)", () => {
        expect.assertions(1);

        const t = task("app:lint");
        const store = new TaskStore([t], 1);

        // No startTasks call — a cache hit can report straight through endTasks.
        store.endTasks([result(t, "local-cache", "")]);

        expect(store.getSnapshot().running).toBe(0);
    });

    it("resets running on rerun", () => {
        expect.assertions(2);

        const t = task("app:lint");
        const store = new TaskStore([t], 1);

        store.startTasks([t]);

        expect(store.getSnapshot().running).toBe(1);

        store.requestRerun();

        expect(store.getSnapshot().running).toBe(0);
    });
});
