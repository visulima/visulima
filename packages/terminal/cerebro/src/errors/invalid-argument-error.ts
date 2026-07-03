import CerebroError from "./cerebro-error";

/**
 * Error thrown when argument configuration is invalid.
 */
class InvalidArgumentError extends CerebroError {
    public readonly argumentName: string;

    public constructor(argumentName: string, message: string) {
        super(message, "INVALID_ARGUMENT", { argumentName });
        this.name = "InvalidArgumentError";
        this.argumentName = argumentName;
    }
}

export default InvalidArgumentError;
