import type { Task } from "@visulima/task-runner";

import { definePlugin } from "../config/config";
import type { VisPlugin } from "../util/hooks";

/**
 * Minimal OTel-shaped span. Deliberately structural so users can pass
 * an `@opentelemetry/api` Tracer, an `@opentelemetry/sdk-node` one, or
 * a custom implementation without the plugin depending on any
 * particular OTel package.
 */
export interface OtelSpan {
    end: () => void;
    recordException?: (error: unknown) => void;
    setAttribute?: (key: string, value: boolean | number | string) => void;
    setStatus?: (status: { code: number; message?: string }) => void;
}

/**
 * Minimal Tracer contract. Accepts the real
 * `@opentelemetry/api`'s `Tracer.startSpan(name, options?)` shape —
 * the plugin only calls the two methods it strictly needs.
 */
export interface OtelTracer {
    startSpan: (name: string, options?: { attributes?: Record<string, string | number | boolean> }) => OtelSpan;
}

export interface OtelPluginOptions {
    /**
     * Rename incoming `project:target` IDs before they become OTel
     * span names. Defaults to passing the id through unchanged.
     */
    renameSpan?: (task: Task) => string;
    /** Tracer used to emit spans. Required — pass the one from `@opentelemetry/api`'s `trace.getTracer("vis")`. */
    tracer: OtelTracer;
}

/** OTel status codes (mirrors `@opentelemetry/api`'s `SpanStatusCode`). */
const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

/**
 * Reference plugin that maps vis hook lifecycle events to OTel spans.
 *
 * Emits:
 * - one **root span** named `vis.run` spanning `run:before` → `run:after`
 * - one **child span** per task spanning `task:before` → `task:after`
 *   with attributes `vis.task.id`, `vis.task.project`, `vis.task.target`,
 *   `vis.task.cache_status`, `vis.task.exit_code`
 * - `task:failure` sets span status to ERROR and records the exit code
 *
 * Streaming stdout/stderr events are intentionally **not** emitted as
 * span events — high-frequency chunks would blow up OTel backends. Use
 * a log exporter if you need stream-level visibility.
 * @example
 * ```ts
 * import { trace } from "@opentelemetry/api";
 * import { defineConfig } from "@visulima/vis/config";
 * import { otelPlugin } from "@visulima/vis/plugins/otel";
 *
 * const tracer = trace.getTracer("vis", "1.0.0");
 *
 * export default defineConfig({
 *     plugins: [otelPlugin({ tracer })],
 * });
 * ```
 */
export const otelPlugin = (options: OtelPluginOptions): VisPlugin => {
    const { renameSpan, tracer } = options;

    // Per-run state held in closure — a fresh plugin instance per run
    // wouldn't work because the plugin object is shared across runs.
    // The hook registry itself is run-scoped (see createVisHooks()) so
    // the lookup maps here are effectively per-run anyway.
    let runSpan: OtelSpan | undefined;
    const taskSpans = new Map<string, OtelSpan>();

    return definePlugin({
        hooks: {
            "run:after": (results) => {
                if (!runSpan) {
                    return;
                }

                const failed = [...results.values()].filter((r) => r.status === "failure").length;

                runSpan.setAttribute?.("vis.run.tasks_total", results.size);
                runSpan.setAttribute?.("vis.run.tasks_failed", failed);

                if (failed > 0) {
                    runSpan.setStatus?.({ code: SPAN_STATUS_ERROR, message: `${String(failed)} task(s) failed` });
                } else {
                    runSpan.setStatus?.({ code: SPAN_STATUS_OK });
                }

                runSpan.end();
                runSpan = undefined;

                // Close any task spans that somehow escaped their
                // `task:after` — can happen if the runner short-circuits
                // a task without emitting `endTasks`. Prevents span
                // leaks that would otherwise hang the OTel exporter
                // across watch-mode reruns.
                for (const stray of taskSpans.values()) {
                    stray.end();
                }

                taskSpans.clear();
            },

            "run:before": (context) => {
                // Defensive close: watch-mode reruns or a bug in an
                // upstream hook could leave the previous span open. End
                // it with an abandoned status rather than leak.
                if (runSpan) {
                    runSpan.setStatus?.({ code: SPAN_STATUS_ERROR, message: "run:before fired while previous run was still active" });
                    runSpan.end();
                }

                for (const stray of taskSpans.values()) {
                    stray.end();
                }

                taskSpans.clear();

                runSpan = tracer.startSpan("vis.run", {
                    attributes: {
                        "vis.run.task_count": context.tasks.length,
                        "vis.workspace_root": context.workspaceRoot,
                    },
                });
            },

            "task:after": (task, result) => {
                const span = taskSpans.get(task.id);

                if (!span) {
                    return;
                }

                span.setAttribute?.("vis.task.exit_code", result.code ?? 0);
                span.setAttribute?.("vis.task.cache_status", result.status);

                span.end();
                taskSpans.delete(task.id);
            },

            "task:before": (task) => {
                // On retry, the same task id fires `task:before` again.
                // End the stale span so we don't leak and the tracer's
                // parent/child tree stays sensible.
                const existing = taskSpans.get(task.id);

                if (existing) {
                    existing.setStatus?.({ code: SPAN_STATUS_ERROR, message: "retried — superseded by new attempt" });
                    existing.end();
                }

                const span = tracer.startSpan(renameSpan ? renameSpan(task) : task.id, {
                    attributes: {
                        "vis.task.id": task.id,
                        "vis.task.project": task.target.project,
                        "vis.task.target": task.target.target,
                    },
                });

                taskSpans.set(task.id, span);
            },

            "task:failure": (task, result) => {
                const span = taskSpans.get(task.id);

                if (!span) {
                    return;
                }

                span.setStatus?.({
                    code: SPAN_STATUS_ERROR,
                    message: `Task failed with exit code ${String(result.code ?? -1)}`,
                });
            },
        },
        name: "otel",
    });
};
