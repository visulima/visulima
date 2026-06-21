import type { StandardSchemaV1 } from "@standard-schema/spec";

/** A value that may be returned directly or as a promise. */
export type MaybePromise<T> = Promise<T> | T;

/**
 * A human-friendly duration. Either a raw millisecond count, a structured
 * `{ amount, unit }` pair, or a `{ cron }` expression resolved against "now".
 */
export type Duration = number | { amount: number; unit: DurationUnit } | { cron: string; tz?: string };

/** Units accepted by the structured {@link Duration} form. */
export type DurationUnit = "days" | "hours" | "milliseconds" | "minutes" | "ms" | "seconds" | "weeks";

/** A JSON-serialisable snapshot of an `Error`, persisted in run history. */
export interface SerializedError {
    message: string;
    name: string;
    stack?: string;
}

/** A completed `ctx.step` recorded in history. */
export interface StepDoneRecord {
    id: string;
    output: unknown;
    type: "step";
}

/** A completed `ctx.sleep` recorded in history. */
export interface SleepDoneRecord {
    id: string;
    type: "sleep";
}

/** A `ctx.waitForEvent` resolved by a delivered signal. */
export interface EventDoneRecord {
    id: string;
    output: unknown;
    type: "event";
}

/** A `ctx.waitForEvent` resolved by its timeout. */
export interface EventTimeoutRecord {
    id: string;
    timedOut: true;
    type: "event";
}

/**
 * A single recorded outcome in a run's append-only history. Only *completed*
 * outcomes are recorded; an in-flight suspension is tracked separately via
 * {@link PendingSuspension}. Records are keyed by their step `id`.
 */
export type StepRecord = EventDoneRecord | EventTimeoutRecord | SleepDoneRecord | StepDoneRecord;

/** What a suspended run is waiting on before it can resume. */
export type PendingSuspension = { eventName: string; id: string; kind: "event"; timeoutAt?: number } | { id: string; kind: "sleep"; wakeAt: number };

/**
 * Observable status of a workflow run. `running` is transient and internal to an
 * activation, so it is never persisted or returned at an API boundary.
 */
export type RunStatus = "completed" | "failed" | "suspended" | "waiting";

/**
 * The context handed to a workflow body. Every durable operation goes through
 * `ctx` so the engine can record, skip and resume it deterministically.
 *
 * IMPORTANT: any side effect that must run *exactly once* has to be wrapped in
 * {@link RunContext.step}. Code outside `step`/`sleep`/`waitForEvent` re-executes
 * on every replay.
 */
export interface RunContext<PayloadT = unknown> {
    /** The validated trigger payload. */
    readonly payload: PayloadT;
    /** The id of the current run. */
    readonly runId: string;

    /**
     * Durably pause the run for a duration, then resume.
     * @param id A stable, unique id for this sleep.
     * @param duration How long to pause.
     */
    sleep: (id: string, duration: Duration) => Promise<void>;

    /**
     * Run a side effect exactly once. The result is recorded; on replay the
     * recorded value is returned without re-executing the function.
     * @param id A stable, unique id for this step within the workflow.
     * @param function_ The side effect to run.
     */
    step: <T>(id: string, function_: () => MaybePromise<T>) => Promise<T>;

    /**
     * Durably suspend until an external event is delivered via
     * `runtime.signal(runId, name, payload)`, or the optional timeout elapses.
     * @param id A stable, unique id for this wait.
     * @param name The event name to wait for.
     * @param options Optional settings for the wait.
     * @param options.timeout How long to wait before resolving to `undefined`.
     * @returns The signalled payload, or `undefined` on timeout.
     */
    waitForEvent: <T = unknown>(id: string, name: string, options?: { timeout?: Duration }) => Promise<T | undefined>;
}

/** The body of a workflow: an async function driven by {@link RunContext}. */
export type WorkflowRun<PayloadT, OutputT> = (context: RunContext<PayloadT>) => MaybePromise<OutputT>;

/** Options accepted by `defineWorkflow`. */
export interface WorkflowConfig<PayloadT, OutputT> {
    /** Unique id of the workflow, used as the namespace for run ids and storage. */
    id: string;
    /** Optional Standard Schema validating (and typing) the trigger payload. */
    payload?: StandardSchemaV1<unknown, PayloadT>;
    /** The workflow body. */
    run: WorkflowRun<PayloadT, OutputT>;
    /** Optional free-form tags for routing/observability. */
    tags?: string[];
}

/**
 * Brand symbol marking an object as a defined workflow.
 * @internal
 */
export const WORKFLOW_BRAND: unique symbol = Symbol("visulima.workflow");

/** A defined workflow: the config plus the validated payload-schema accessor. */
export interface WorkflowDefinition<PayloadT = unknown, OutputT = unknown> extends WorkflowConfig<PayloadT, OutputT> {
    /** Validate (and parse) an unknown input against the payload schema. */
    parsePayload: (input: unknown) => Promise<PayloadT>;
    /** Brand marking this object as a defined workflow. */
    readonly [WORKFLOW_BRAND]: true;
}
