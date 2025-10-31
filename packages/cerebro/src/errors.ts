/**
 * Base error class for Cerebro CLI operations
 */
export class CerebroError extends Error {
    public readonly code: string;

    public readonly context?: Record<string, unknown>;

    public constructor(message: string, code: string, context?: Record<string, unknown>) {
        super(message);
        this.name = "CerebroError";
        this.code = code;
        this.context = context;
    }
}

/**
 * Error thrown when a command is not found
 */
export class CommandNotFoundError extends CerebroError {
    public readonly commandName: string;

    public constructor(commandName: string, suggestions: string[] = []) {
        super(`Command "${commandName}" not found${suggestions.length > 0 ? `. Did you mean: ${suggestions.join(", ")}?` : ""}`, "COMMAND_NOT_FOUND", {
            commandName,
            suggestions,
        });
        this.name = "CommandNotFoundError";
        this.commandName = commandName;
    }
}

/**
 * Error thrown when command validation fails
 */
export class CommandValidationError extends CerebroError {
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
    }
}

/**
 * Error thrown when there are conflicting options
 */
export class ConflictingOptionsError extends CerebroError {
    public readonly option1: string;

    public readonly option2: string;

    public constructor(option1: string, option2: string) {
        super(`Options "${option1}" and "${option2}" cannot be used together`, "CONFLICTING_OPTIONS", { option1, option2 });
        this.name = "ConflictingOptionsError";
        this.option1 = option1;
        this.option2 = option2;
    }
}

/**
 * Error thrown when plugin operations fail
 */
export class PluginError extends CerebroError {
    public readonly pluginName: string;

    public constructor(pluginName: string, message: string, originalError?: Error) {
        super(`Plugin "${pluginName}" error: ${message}`, "PLUGIN_ERROR", { originalError, pluginName });
        this.name = "PluginError";
        this.pluginName = pluginName;

        if (originalError) {
            this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
        }
    }
}

/**
 * Error code constants for type safety
 */
export const ErrorCodes = {
    COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
    COMMAND_VALIDATION_ERROR: "COMMAND_VALIDATION_ERROR",
    CONFLICTING_OPTIONS: "CONFLICTING_OPTIONS",
    DUPLICATE_COMMAND: "DUPLICATE_COMMAND",
    INVALID_COMMAND_NAME: "INVALID_COMMAND_NAME",
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_PLUGIN_NAME: "INVALID_PLUGIN_NAME",
    PLUGIN_ERROR: "PLUGIN_ERROR",
} as const satisfies Record<string, string>;

export type ErrorCode = keyof typeof ErrorCodes;
