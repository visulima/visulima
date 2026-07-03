import CerebroError from "./cerebro-error";

/**
 * Error thrown when there are conflicting options.
 */
class ConflictingOptionsError extends CerebroError {
    public readonly option1: string;

    public readonly option2: string;

    public constructor(option1: string, option2: string) {
        super(`Options "${option1}" and "${option2}" cannot be used together`, "CONFLICTING_OPTIONS", { option1, option2 });
        this.name = "ConflictingOptionsError";
        this.option1 = option1;
        this.option2 = option2;
        this.hint = `Remove either --${option1} or --${option2}`;
    }
}

export default ConflictingOptionsError;
