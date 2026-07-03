import resolveWakeAt from "./duration";
import WorkflowError, { DuplicateStepIdError, isSuspendSignal, serializeError, SuspendSignal } from "./errors";
import type { Duration, MaybePromise, PendingSuspension, RunContext, SerializedError, StepRecord, WorkflowDefinition } from "./types";

/** The run finished with an output. */
interface CompletedOutcome {
    history: StepRecord[];
    output: unknown;
    status: "completed";
}

/** The run threw and stopped. */
interface FailedOutcome {
    error: SerializedError;
    history: StepRecord[];
    status: "failed";
}

/** The run hit an unsatisfied sleep/wait and unwound. */
interface SuspendedOutcome {
    history: StepRecord[];
    pending: PendingSuspension;
    status: "suspended";
}

/** The result of a single execution attempt. */
type ExecOutcome = CompletedOutcome | FailedOutcome | SuspendedOutcome;

const reuseError = (id: string, was: StepRecord["type"], now: StepRecord["type"]): WorkflowError =>
    new WorkflowError("step-id-reused", `Step id "${id}" was previously used as a "${was}" but is now used as a "${now}".`);

/**
 * Execute (or replay) a workflow body once against its prior history.
 *
 * Steps already present in `priorHistory` short-circuit to their recorded value;
 * the first unsatisfied `sleep`/`waitForEvent` throws a {@link SuspendSignal}
 * that unwinds the body and yields a `suspended` outcome.
 * @internal
 */
const executeRun = async <PayloadT, OutputT>(
    definition: WorkflowDefinition<PayloadT, OutputT>,
    payload: PayloadT,
    runId: string,
    priorHistory: StepRecord[],
): Promise<ExecOutcome> => {
    const history: StepRecord[] = [...priorHistory];
    const byId = new Map<string, StepRecord>(history.map((record) => [record.id, record]));
    const usedIds = new Set<string>();

    const claimId = (id: string): void => {
        if (usedIds.has(id)) {
            throw new DuplicateStepIdError(id);
        }

        usedIds.add(id);
    };

    const context: RunContext<PayloadT> = {
        payload,
        runId,
        sleep: (id, duration): Promise<void> => {
            claimId(id);

            const existing = byId.get(id);

            if (existing) {
                if (existing.type !== "sleep") {
                    throw reuseError(id, existing.type, "sleep");
                }

                return Promise.resolve();
            }

            throw new SuspendSignal({ id, kind: "sleep", wakeAt: resolveWakeAt(duration) });
        },
        step: async <T>(id: string, function_: () => MaybePromise<T>): Promise<T> => {
            claimId(id);

            const existing = byId.get(id);

            if (existing) {
                if (existing.type !== "step") {
                    throw reuseError(id, existing.type, "step");
                }

                return existing.output as T;
            }

            const output = await function_();
            const record: StepRecord = { id, output, type: "step" };

            history.push(record);
            byId.set(id, record);

            return output;
        },
        waitForEvent: <T>(id: string, name: string, options?: { timeout?: Duration }): Promise<T | undefined> => {
            claimId(id);

            const existing = byId.get(id);

            if (existing) {
                if (existing.type !== "event") {
                    throw reuseError(id, existing.type, "event");
                }

                if ("timedOut" in existing) {
                    return Promise.resolve(undefined);
                }

                return Promise.resolve(existing.output as T);
            }

            throw new SuspendSignal({
                eventName: name,
                id,
                kind: "event",
                timeoutAt: options?.timeout === undefined ? undefined : resolveWakeAt(options.timeout),
            });
        },
    };

    try {
        const output = await definition.run(context);

        return { history, output, status: "completed" };
    } catch (error) {
        if (isSuspendSignal(error)) {
            return { history, pending: error.pending, status: "suspended" };
        }

        return { error: serializeError(error), history, status: "failed" };
    }
};

export default executeRun;
