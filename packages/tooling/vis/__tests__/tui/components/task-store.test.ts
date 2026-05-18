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

    it("source-maps + code-frames a failure's terminal output and preserves the raw block", () => {
        expect.assertions(3);

        const file = join(dir, "boom.js");

        writeFileSync(file, "const a = 1;\nthrow new TypeError('store boom');\n");

        const t = task("app:build");
        const store = new TaskStore([t]);

        store.endTasks([result(t, "failure", ["> runner", "", "TypeError: store boom", `    at run (${file}:2:7)`].join("\n"))]);

        const out = strip(store.getSnapshot().outputs.get("app:build") ?? "");

        expect(out).toContain("✖ TypeError: store boom");
        expect(out).toContain("throw new TypeError('store boom');");
        // Raw runner output is preserved verbatim beneath the rendered block.
        expect(out).toContain("> runner");
    });

    it("renders previously streamed output when the failure result carries none", () => {
        expect.assertions(2);

        const file = join(dir, "stream.js");

        writeFileSync(file, "throw new Error('streamed');\n");

        const t = task("app:test");
        const store = new TaskStore([t]);

        // Output arrived incrementally before the result; the result itself
        // has an empty terminalOutput. endTasks must still render the stream.
        store.addOutput("app:test", ["Error: streamed", `    at x (${file}:1:7)`].join("\n"));
        store.endTasks([result(t, "failure", "")]);

        const out = strip(store.getSnapshot().outputs.get("app:test") ?? "");

        expect(out).toContain("✖ Error: streamed");
        expect(out).toContain("throw new Error('streamed');");
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
