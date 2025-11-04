import CerebroError from "./cerebro-error";

/**
 * Error thrown when a command is not found.
 */
class CommandNotFoundError extends CerebroError {
    public readonly commandName: string;

    public constructor(commandName: string, suggestions: string[] = []) {
        const message = `Command "${commandName}" not found${suggestions.length > 0 ? `. Did you mean: ${suggestions.join(", ")}?` : ""}`;

        super(message, "COMMAND_NOT_FOUND", {
            commandName,
            suggestions,
        });
        this.name = "CommandNotFoundError";
        this.commandName = commandName;

        if (suggestions.length > 0) {
            this.hint = `Try one of these commands: ${suggestions.join(", ")}`;
        }
    }
}

export default CommandNotFoundError;
