import CerebroError from "./cerebro-error";

/**
 * Error thrown when unknown options or arguments are detected.
 */
class UnknownOptionError extends CerebroError {
    public readonly unknownOptions: string[];

    public constructor(unknownOptions: string[], suggestions?: string[]) {
        const options = unknownOptions.join(", ");
        const message = `Found unknown ${unknownOptions.length === 1 ? "option" : "options"}: ${options}`;

        super(message, "UNKNOWN_OPTION", { suggestions, unknownOptions });
        this.name = "UnknownOptionError";
        this.unknownOptions = unknownOptions;

        if (suggestions && suggestions.length > 0) {
            this.hint = `Did you mean: ${suggestions.join(", ")}?`;
        }
    }
}

export default UnknownOptionError;
