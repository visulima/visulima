import { StagedError } from "./staged-error";

/** A user-provided task exited non-zero or threw. */
export class TaskError extends StagedError {
    public readonly commandTitle: string;

    public constructor(commandTitle: string, message: string, options?: ErrorOptions) {
        super(message, options);
        this.commandTitle = commandTitle;
    }
}
