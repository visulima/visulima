import CerebroError from "./cerebro-error";

/**
 * Error thrown when a command is invoked without one of its required positional
 * arguments. Distinct from `CommandValidationError`, which reports missing
 * options* — telling a user to "provide the required option" for a positional
 * sends them looking for a `--flag` that does not exist.
 */
class MissingArgumentError extends CerebroError {
    public readonly commandName: string;

    public readonly missingArguments: string[];

    public constructor(commandName: string, missingArguments: string[]) {
        super(`Command "${commandName}" is missing required arguments: ${missingArguments.join(", ")}`, "MISSING_ARGUMENT", {
            commandName,
            missingArguments,
        });
        this.name = "MissingArgumentError";
        this.commandName = commandName;
        this.missingArguments = missingArguments;
        this.hint = `Provide the following positional arguments: ${missingArguments.join(", ")}`;
    }
}

export default MissingArgumentError;
