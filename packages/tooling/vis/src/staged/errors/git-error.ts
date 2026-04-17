import { StagedError } from "./staged-error";

/** A git subprocess failed. Holds the stderr tail for surface-level reporting. */
export class GitError extends StagedError {
    public readonly stderr?: string;

    public constructor(message: string, stderr?: string, options?: ErrorOptions) {
        super(message, options);
        this.stderr = stderr;
    }
}
