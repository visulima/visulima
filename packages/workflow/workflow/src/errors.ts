/* eslint-disable max-classes-per-file -- cohesive error + control-flow hierarchy for the engine */
import type { PendingSuspension, SerializedError } from "./types";

/**
 * Base error for all engine failures. Carries a machine-readable `code`.
 */
class WorkflowError extends Error {
    public readonly code: string;

    public constructor(code: string, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "WorkflowError";
        this.code = code;
    }
}

/** Thrown when two steps in one run share the same id. */
export class DuplicateStepIdError extends WorkflowError {
    public constructor(id: string) {
        super("duplicate-step-id", `Duplicate step id "${id}". Every step/sleep/waitForEvent id must be unique within a workflow.`);
        this.name = "DuplicateStepIdError";
    }
}

/** Thrown when a run id cannot be found in the store. */
export class RunNotFoundError extends WorkflowError {
    public constructor(runId: string) {
        super("run-not-found", `No run found for id "${runId}".`);
        this.name = "RunNotFoundError";
    }
}

/**
 * Internal control-flow signal thrown to unwind the workflow body when it hits
 * an unsatisfied `sleep`/`waitForEvent`. Never surfaced to user code.
 * @internal
 */
export class SuspendSignal extends Error {
    public readonly pending: PendingSuspension;

    public constructor(pending: PendingSuspension) {
        super("workflow suspended");
        this.name = "SuspendSignal";
        this.pending = pending;
    }
}

/**
 * Type guard for the internal {@link SuspendSignal}.
 * @internal
 */
export const isSuspendSignal = (value: unknown): value is SuspendSignal => value instanceof SuspendSignal;

/** Serialise an unknown thrown value into a persistable {@link SerializedError}. */
export const serializeError = (error: unknown): SerializedError => {
    if (error instanceof Error) {
        return { message: error.message, name: error.name, stack: error.stack };
    }

    return { message: String(error), name: "Error" };
};

export default WorkflowError;
