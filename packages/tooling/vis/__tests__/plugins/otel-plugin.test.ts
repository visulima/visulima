import type { Span, SpanOptions, Tracer } from "@opentelemetry/api";
import type { Task, TaskResult, TaskResults } from "@visulima/task-runner";
import { describe, expect, it, vi } from "vitest";

import { otelPlugin } from "../../src/plugins/otel";
import { createVisHooks, registerPlugins } from "../../src/util/hooks";

type AttributeValue = boolean | number | string;

interface RecordedSpan {
    attributes: Record<string, AttributeValue>;
    ended: boolean;
    name: string;
    status?: { code: number; message?: string };
}

const createRecordingTracer = (): { spans: RecordedSpan[]; tracer: Tracer } => {
    const spans: RecordedSpan[] = [];

    const tracer = {
        startSpan: (name: string, options?: SpanOptions): Span => {
            const record: RecordedSpan = {
                attributes: { ...(options?.attributes as Record<string, AttributeValue> | undefined) },
                ended: false,
                name,
            };

            spans.push(record);

            const span = {
                end: (): void => {
                    record.ended = true;
                },
                setAttribute: (key: string, value: AttributeValue): Span => {
                    record.attributes[key] = value;

                    return span;
                },
                setStatus: (status: { code: number; message?: string }): Span => {
                    record.status = status;

                    return span;
                },
            } as unknown as Span;

            return span;
        },
    } as unknown as Tracer;

    return { spans, tracer };
};

const makeTask = (id: string): Task => {
    return {
        id,
        outputs: [],
        overrides: {},
        target: { project: id.split(":")[0] ?? "a", target: id.split(":")[1] ?? "build" },
    };
};

const makeResult = (task: Task, status: TaskResult["status"] = "success", code = 0): TaskResult => {
    return {
        code,
        endTime: Date.now(),
        startTime: Date.now() - 100,
        status,
        task,
        terminalOutput: "",
    };
};

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

    it("tracer.startSpan is only called once per task:before", async () => {
        expect.assertions(1);

        const spy = vi.fn<Tracer["startSpan"]>(() => ({
            end: () => {},
            setAttribute: () => undefined as unknown as Span,
            setStatus: () => undefined as unknown as Span,
        } as unknown as Span));

        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer: { startSpan: spy } as unknown as Tracer })]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);

        // Called once for the task. run:before wasn't fired so the
        // root span isn't counted here.
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("task:before for an already-running task ends the stale span (retry safety)", async () => {
        expect.assertions(4);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        const task = makeTask("app:build");

        await hooks.callHook("task:before", task);
        // Second task:before — simulates a retry loop where the
        // original span never got an after. Defensive close prevents
        // the span from leaking.
        await hooks.callHook("task:before", task);

        const taskSpans = spans.filter((s) => s.name === "app:build");

        expect(taskSpans).toHaveLength(2);
        expect(taskSpans[0]?.ended).toBe(true);
        expect(taskSpans[0]?.status?.code).toBe(2);
        expect(taskSpans[1]?.ended).toBe(false);
    });

    it("run:before re-entry closes the previous root span + any live task spans", async () => {
        expect.assertions(4);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        await hooks.callHook("run:before", { tasks: [makeTask("app:build")], workspaceRoot: "/ws" });
        await hooks.callHook("task:before", makeTask("app:build"));
        // Second run:before without a matching run:after — watch mode
        // shouldn't happen in practice, but the defensive close keeps
        // exporters from stalling on unclosed spans.
        await hooks.callHook("run:before", { tasks: [makeTask("app:build")], workspaceRoot: "/ws" });

        const runSpans = spans.filter((s) => s.name === "vis.run");

        expect(runSpans).toHaveLength(2);
        expect(runSpans[0]?.ended).toBe(true);
        expect(runSpans[0]?.status?.code).toBe(2);

        const taskSpan = spans.find((s) => s.name === "app:build");

        expect(taskSpan?.ended).toBe(true);
    });

    it("run:after closes any task spans that never received task:after", async () => {
        expect.assertions(3);

        const { spans, tracer } = createRecordingTracer();
        const hooks = createVisHooks();

        await registerPlugins(hooks, [otelPlugin({ tracer })]);

        await hooks.callHook("run:before", { tasks: [makeTask("app:build")], workspaceRoot: "/ws" });
        await hooks.callHook("task:before", makeTask("app:build"));
        // Orchestrator short-circuited: run:after fires without a
        // matching task:after. The plugin must close the stray span.
        await hooks.callHook("run:after", new Map() as TaskResults);

        const runSpan = spans.find((s) => s.name === "vis.run");
        const taskSpan = spans.find((s) => s.name === "app:build");

        expect(runSpan?.ended).toBe(true);
        expect(taskSpan?.ended).toBe(true);
        // The stray close uses plain `end()` (no status), so the
        // recorded status should still be undefined for the task span.
        expect(taskSpan?.status).toBeUndefined();
    });
});
