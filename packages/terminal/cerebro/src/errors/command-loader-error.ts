import CerebroError from "./cerebro-error";

/**
 * Error thrown when a lazy command's `loader` fails or returns a module without a usable default export.
 */
class CommandLoaderError extends CerebroError {
    public readonly commandName: string;

    public constructor(commandName: string, reason: string, cause?: unknown) {
        super(`Failed to load command "${commandName}": ${reason}`, "COMMAND_LOADER_ERROR", { commandName, reason });
        this.name = "CommandLoaderError";
        this.commandName = commandName;
        this.hint = `Ensure the loader resolves to a module with a default export that is the command handler function.`;

        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}

export default CommandLoaderError;
