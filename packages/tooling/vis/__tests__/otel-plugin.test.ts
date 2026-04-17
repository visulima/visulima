import type { Task, TaskResult, TaskResults } from "@visulima/task-runner";
import { describe, expect, it, vi } from "vitest";

import { createVisHooks, registerPlugins } from "../src/hooks";
import type { OtelSpan, OtelTracer } from "../src/plugins/otel";
import { otelPlugin } from "../src/plugins/otel";

interface RecordedSpan {
    attributes: Record<string, boolean | number | string>;
    ended: boolean;
    name: string;
    status?: { code: number; message?: string };
}

const createRecordingTracer = (): { spans: RecordedSpan[]; tracer: OtelTracer } => {
    const spans: RecordedSpan[] = [];

    const tracer: OtelTracer = {
        startSpan: (name, options) => {
            const record: RecordedSpan = {
                attributes: { ...(options?.attributes ?? {}) },
                ended: false,
                name,
            };

            spans.push(record);

            const span: OtelSpan = {
                end: () => {
                    record.ended = true;
                },
                setAttribute: (key, value) => {
                    record.attributes[key] = value;
                },
                setStatus: (status) => {
                    record.status = status;
                },
            };

            return span;
        },
    };

    return { spans, tracer };
};

const makeTask = (id: string): Task => ({
    id,
    outputs: [],
    overrides: {},
    target: { project: id.split(":")[0] ?? "a", target: id.split(":")[1] ?? "build" },
});

const makeResult = (task: Task, status: TaskResult["status"] = "success", code = 0): TaskResult => ({
    code,
    endTime: Date.now(),
    startTime: Date.now() - 100,
    status,
    task,
    terminalOutput: "",
});

describe(otelPlugin, () => {
    it("emits a vis.run root span with task count + workspace attributes", async () => {
        expect.assertions(3);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const tasks = [makeTask("a:build"), makeTask("b:build")];

        await hooks.callHook("run:before", { tasks, workspaceRoot: "/ws" });
        await hooks.callHook("run:after", new Map() as TaskResults);

        const runSpan = spans.find((s) => s.name === "vis.run");

        expect(runSpan).toBeDefined();
        expect(runSpan?.attributes["vis.workspace_root"]).toBe("/ws");
        expect(runSpan?.attributes["vis.run.task_count"]).toBe(2);
    });

    it("opens a task span per task:before and closes it on task:after with exit_code", async () => {
        expect.assertions(4);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);
        await hooks.callHook("task:after", task, makeResult(task, "success", 0));

        const taskSpan = spans.find((s) => s.name === "app:build");

        expect(taskSpan).toBeDefined();
        expect(taskSpan?.ended).toBe(true);
        expect(taskSpan?.attributes["vis.task.project"]).toBe("app");
        expect(taskSpan?.attributes["vis.task.exit_code"]).toBe(0);
    });

    it("marks the task span with ERROR status on task:failure", async () => {
        expect.assertions(1);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);
        await hooks.callHook("task:failure", task, makeResult(task, "failure", 1));
        await hooks.callHook("task:after", task, makeResult(task, "failure", 1));

        const taskSpan = spans.find((s) => s.name === "app:build");

        // 2 = OTel SpanStatusCode.ERROR
        expect(taskSpan?.status?.code).toBe(2);
    });

    it("run:after reports failures count + ERROR status when tasks failed", async () => {
        expect.assertions(2);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const results = new Map<string, TaskResult>([
            ["a:build", makeResult(makeTask("a:build"), "success")],
            ["b:build", makeResult(makeTask("b:build"), "failure", 1)],
        ]);

        await hooks.callHook("run:before", { tasks: [], workspaceRoot: "/ws" });
        await hooks.callHook("run:after", results);

        const runSpan = spans.find((s) => s.name === "vis.run");

        expect(runSpan?.attributes["vis.run.tasks_failed"]).toBe(1);
        expect(runSpan?.status?.code).toBe(2);
    });

    it("renameSpan rewrites task span names", async () => {
        expect.assertions(1);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [
            otelPlugin({
                renameSpan: (task) => `vis.task:${task.target.project}/${task.target.target}`,
                tracer,
            }),
        ]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);

        expect(spans.some((s) => s.name === "vis.task:app/build")).toBe(true);
    });

    it("is safe to call after:task when no before:task ran (no throw)", async () => {
        expect.assertions(1);

        const { tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const task = makeTask("ghost:build");
        // `callHook` can return void when all handlers are sync — wrap
        // to normalize to a Promise for the resolves matcher.
        const result = await Promise.resolve(hooks.callHook("task:after", task, makeResult(task)));

        expect(result).toBeUndefined();
    });

    it("Tracer.startSpan is only called once per task:before", async () => {
        expect.assertions(1);

        const spy = vi.fn<OtelTracer["startSpan"]>(() => ({
            end: () => {},
            setAttribute: () => {},
            setStatus: () => {},
        }));

        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer: { startSpan: spy } })]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);

        // Called once for the task. run:before wasn't fired so the
        // root span isn't counted here.
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
