import CerebroError from "./cerebro-error";

/**
 * Error thrown when command validation fails.
 */
class CommandValidationError extends CerebroError {
    public readonly commandName: string;

    public readonly missingOptions: string[];

    public constructor(commandName: string, missingOptions: string[]) {
        super(`Command "${commandName}" is missing required options: ${missingOptions.join(", ")}`, "COMMAND_VALIDATION_ERROR", {
            commandName,
            missingOptions,
        });
        this.name = "CommandValidationError";
        this.commandName = commandName;
        this.missingOptions = missingOptions;
        this.hint = `Provide the following required options: ${missingOptions.join(", ")}`;
    }
}

export default CommandValidationError;
