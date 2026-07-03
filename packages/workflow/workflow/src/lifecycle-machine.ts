import { assign, setup } from "xstate";

import type { PendingSuspension, SerializedError, StepRecord } from "./types";

/**
 * The XState context backing a single run; serialised in the persisted snapshot.
 * @internal
 */
interface RunContextData {
    definitionId: string;
    error?: SerializedError;
    history: StepRecord[];
    output?: unknown;
    payload: unknown;
    pending?: PendingSuspension;
}

/**
 * Input required to start a fresh run actor.
 * @internal
 */
interface RunActorInput {
    definitionId: string;
    history: StepRecord[];
    payload: unknown;
}

/** Run failed with a serialised error. */
interface FailEvent {
    error: SerializedError;
    history: StepRecord[];
    type: "FAIL";
}

/** Run completed with an output. */
interface CompleteEvent {
    history: StepRecord[];
    output: unknown;
    type: "COMPLETE";
}

/** Run suspended on a sleep or event wait. */
interface SuspendEvent {
    history: StepRecord[];
    pending: PendingSuspension;
    type: "SUSPEND";
}

/** Suspended run advanced by a resolved step record. */
interface ResumeEvent {
    record: StepRecord;
    type: "RESUME";
}

/**
 * Events that drive the lifecycle machine.
 * @internal
 */
type RunEvent = CompleteEvent | FailEvent | ResumeEvent | SuspendEvent;

/**
 * Lifecycle state machine for a workflow run. XState owns the legal transitions
 * (`running → suspended/waiting → running → completed/failed`) and produces the
 * JSON snapshot persisted by the store; the actual step execution is driven
 * outside the machine and fed back in as events.
 * @internal
 */
const runMachine = setup({
    types: {
        context: {} as RunContextData,
        events: {} as RunEvent,
        input: {} as RunActorInput,
    },
}).createMachine({
    context: ({ input }) => {
        return {
            definitionId: input.definitionId,
            history: input.history,
            payload: input.payload,
        };
    },
    id: "workflow-run",
    initial: "running",
    states: {
        completed: { type: "final" },
        failed: { type: "final" },
        running: {
            on: {
                COMPLETE: {
                    actions: assign({ history: ({ event }) => event.history, output: ({ event }) => event.output, pending: undefined }),
                    target: "completed",
                },
                FAIL: {
                    actions: assign({ error: ({ event }) => event.error, history: ({ event }) => event.history, pending: undefined }),
                    target: "failed",
                },
                SUSPEND: [
                    {
                        actions: assign({ history: ({ event }) => event.history, pending: ({ event }) => event.pending }),
                        guard: ({ event }) => event.pending.kind === "sleep",
                        target: "suspended",
                    },
                    {
                        actions: assign({ history: ({ event }) => event.history, pending: ({ event }) => event.pending }),
                        target: "waiting",
                    },
                ],
            },
        },
        suspended: {
            on: {
                RESUME: {
                    actions: assign({ history: ({ context, event }) => [...context.history, event.record], pending: undefined }),
                    target: "running",
                },
            },
        },
        waiting: {
            on: {
                RESUME: {
                    actions: assign({ history: ({ context, event }) => [...context.history, event.record], pending: undefined }),
                    target: "running",
                },
            },
        },
    },
});

export default runMachine;
