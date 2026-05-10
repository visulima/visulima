import type { FingerprintContributor, LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";
import type { Hookable } from "hookable";
import { createHooks } from "hookable";

import type { ServiceEntry } from "../services/types";

export type { FingerprintContributor } from "@visulima/task-runner";

/**
 * Typed hook surface exposed to vis plugins.
 *
 * Plugins subscribe via `hooks.hook(name, handler)` — handlers are
 * awaited sequentially in registration order. Returning a promise
 * delays the next hook firing until it resolves, so plugins can
 * safely perform async setup/teardown.
 *
 * Naming deliberately mirrors vite-task / webpack-style verbs:
 *   before/after for boundaries, on&lt;Event> for passive observation.
 */
export interface VisHooks {
    /**
     * Fired after the entire task graph completes (including any
     * failures). `results` maps task ID → {@link TaskResult}.
     */
    "run:after": (results: Map<string, TaskResult>) => Promise<void> | void;

    /**
     * Fired once before any task in the graph starts, after workspace
     * discovery and graph construction. Throwing aborts the run.
     */
    "run:before": (context: { tasks: Task[]; workspaceRoot: string }) => Promise<void> | void;

    /**
     * Fired after `vis run` auto-attaches to one or more registered
     * services. `taskIds` lists the in-graph dependents that consumed
     * the service's `env` block; an empty array means the service was
     * registered but no kept task depended on it.
     */
    "service:attach": (entry: ServiceEntry, taskIds: ReadonlyArray<string>) => Promise<void> | void;

    /**
     * Fired after a service is registered and its readiness probe
     * succeeds. Sourced from both `vis service start` (and `restart`'s
     * post-start phase) and any future programmatic call sites.
     */
    "service:start": (entry: ServiceEntry) => Promise<void> | void;

    /**
     * Fired after a registered service is stopped (SIGTERM/SIGKILL
     * acknowledged, registry entry deleted). Not fired when stop is
     * called against an unknown id — only when there was an alive
     * entry to terminate.
     */
    "service:stop": (entry: ServiceEntry) => Promise<void> | void;

    /**
     * Fired after a task completes (success, failure, or cache hit).
     * Receives the final {@link TaskResult}.
     */
    "task:after": (task: Task, result: TaskResult) => Promise<void> | void;

    /**
     * Fired before each task begins execution — after scheduling, before
     * the executor runs the command. Throwing aborts that single task.
     */
    "task:before": (task: Task) => Promise<void> | void;

    /** Fired when a task hit the local or remote cache. */
    "task:cacheHit": (task: Task, result: TaskResult) => Promise<void> | void;

    /**
     * Fired when auto-fingerprint cache diagnostics reports a miss,
     * carrying the human-readable reason string.
     */
    "task:cacheMiss": (task: Task, reasons: string) => Promise<void> | void;

    /** Fired when a task exits non-zero. */
    "task:failure": (task: Task, result: TaskResult) => Promise<void> | void;

    /**
     * Fired during fingerprint construction, after built-in inputs are
     * gathered and before the hash is sealed. Plugins call
     * `contributor.contribute(key, value)` to mix arbitrary strings
     * into the task hash — the hasher namespaces and sorts contributions
     * deterministically so call order doesn't change the result.
     *
     * Throwing aborts hashing for the offending task and surfaces as a
     * task failure before any cache lookup runs. Use this to guarantee
     * a buggy plugin can't quietly poison cache state.
     */
    "task:fingerprint": (task: Task, contributor: FingerprintContributor) => Promise<void> | void;

    /**
     * Fired right before a failed task is re-spawned by the retry
     * controller. `attempt` is 1-indexed and counts the retry that's
     * about to start (so the original failed run was attempt 0).
     * `prevExitCode` is the failing exit status that triggered the
     * retry (the full TaskResult isn't materialized at the retry
     * boundary — only the per-attempt close event is available).
     *
     * Throwing aborts the retry; the previous failure becomes the final
     * result.
     */
    "task:retry": (task: Task, attempt: number, prevExitCode: number) => Promise<void> | void;

    /**
     * Fired with a stderr chunk as a running task emits it. Plugins
     * that ship logs live (Slack, Datadog) should prefer this over
     * `task:after` so they don't wait for the full buffer.
     */
    "task:stderr": (task: Task, chunk: string) => Promise<void> | void;

    /**
     * Fired with a stdout chunk as a running task emits it. See
     * `task:stderr` for semantics.
     */
    "task:stdout": (task: Task, chunk: string) => Promise<void> | void;
}

/**
 * Public plugin contract. Implementations register handlers by
 * returning a partial {@link VisHooks} map from `hooks`, or by
 * mutating the Hookable instance directly via `setup(hooks)` for
 * advanced cases (dynamic registration, removeHook, etc.).
 *
 * Plugins are loaded in the order they appear in `visConfig.plugins`.
 * Handler execution order within a hook follows registration order,
 * so earlier plugins see events first.
 */
export interface VisPlugin {
    /**
     * Declarative handlers — the common shape. One entry per hook
     * name; pass a function or an array of functions (all run serially
     * in order).
     */
    hooks?: Partial<{
        [K in keyof VisHooks]: VisHooks[K] | VisHooks[K][];
    }>;
    /** Plugin name — surfaced in debug logs. */
    name: string;

    /**
     * Imperative setup — receives the shared Hookable instance so the
     * plugin can register hooks conditionally, unregister later, or
     * use advanced APIs like `hookOnce`/`beforeEach`/`afterEach`.
     */
    setup?: (hooks: Hookable<VisHooks>) => Promise<void> | void;
}

/**
 * Optional callback invoked whenever a plugin handler throws. Lets
 * callers surface buggy plugins without crashing the run — pass a
 * logger or re-throw to promote plugin errors to fatals.
 */
export type HookErrorHandler = (hookName: keyof VisHooks, error: unknown) => void;

/**
 * Creates a fresh typed hook registry. One instance is created per
 * `vis run` invocation and passed to every plugin's `setup()`.
 */
export const createVisHooks = (): Hookable<VisHooks> => createHooks<VisHooks>();

/**
 * Registers each plugin's handlers against the shared hook instance.
 * Synchronous failures in `setup()` abort plugin loading and propagate.
 */
export const registerPlugins = async (hooks: Hookable<VisHooks>, plugins: VisPlugin[] | undefined): Promise<void> => {
    if (!plugins || plugins.length === 0) {
        return;
    }

    for (const plugin of plugins) {
        if (plugin.hooks) {
            for (const [name, handler] of Object.entries(plugin.hooks) as [keyof VisHooks, VisHooks[keyof VisHooks] | VisHooks[keyof VisHooks][]][]) {
                const handlers = Array.isArray(handler) ? handler : [handler];

                for (const fn of handlers) {
                    hooks.hook(name, fn);
                }
            }
        }

        if (plugin.setup) {
            await plugin.setup(hooks);
        }
    }
};

/**
 * Bridges `LifeCycleInterface` (the task-runner contract) into
 * `VisHooks` events. Register this as a lifecycle alongside the
 * existing UI renderers so plugin authors see the same events the
 * TUI/static output do, without having to understand task-runner's
 * lower-level `LifeCycleInterface` shape.
 */
export class HookableLifeCycle implements LifeCycleInterface {
    readonly #hooks: Hookable<VisHooks>;

    readonly #onError: HookErrorHandler | undefined;

    /** Cached {task.id → Task} for the current run, filled on startTasks. */
    readonly #inFlight = new Map<string, Task>();

    public constructor(hooks: Hookable<VisHooks>, onError?: HookErrorHandler) {
        this.#hooks = hooks;
        this.#onError = onError;
    }

    public startTasks(tasks: Task[]): void {
        for (const task of tasks) {
            this.#inFlight.set(task.id, task);
            // Fire-and-forget — task-runner's startTasks is synchronous.
            // Plugins that need to block task execution should use
            // `run:before` instead.
            this.#fire("task:before", task);
        }
    }

    public endTasks(results: TaskResult[]): void {
        for (const result of results) {
            this.#inFlight.delete(result.task.id);
            this.#fire("task:after", result.task, result);

            if (result.status === "failure") {
                this.#fire("task:failure", result.task, result);
            } else if (isCacheStatus(result.status)) {
                this.#fire("task:cacheHit", result.task, result);
            }
        }
    }

    public printCacheMiss(task: Task, reasons: string): void {
        this.#fire("task:cacheMiss", task, reasons);
    }

    public onTaskStdout(task: Task, chunk: string): void {
        // Streaming hooks are high-frequency; fire-and-forget so the
        // executor's write loop doesn't stall. Failures route through
        // `onError` (when configured) so buggy plugins aren't invisible.
        this.#fire("task:stdout", task, chunk);
    }

    public onTaskStderr(task: Task, chunk: string): void {
        this.#fire("task:stderr", task, chunk);
    }

    #fire<K extends keyof VisHooks>(name: K, ...args: Parameters<VisHooks[K]>): void {
        Promise.resolve(
            // `callHook` is typed as `(name, ...args: any[])` by
            // hookable, so the `Parameters<>` spread needs the cast.
            (this.#hooks.callHook as (name: K, ...a: Parameters<VisHooks[K]>) => Promise<unknown> | undefined)(name, ...args),
        ).catch((error: unknown) => {
            if (this.#onError) {
                try {
                    this.#onError(name, error);
                } catch {
                    // A handler that itself throws must not take down the run.
                }
            }
        });
    }
}

const isCacheStatus = (status: TaskStatus): boolean => status === "local-cache" || status === "local-cache-kept-existing" || status === "remote-cache";
