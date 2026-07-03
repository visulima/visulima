import CerebroError from "./cerebro-error";

/**
 * Error thrown when completion command operations fail.
 */
class CompletionError extends CerebroError {
    public readonly troubleshooting: string[];

    public constructor(message: string, code: string, troubleshooting: string[] = []) {
        super(message, code, { troubleshooting });
        this.name = "CompletionError";
        this.troubleshooting = troubleshooting;

        if (troubleshooting.length > 0) {
            this.hint = troubleshooting.join("\n");
        }
    }
}

export default CompletionError;
