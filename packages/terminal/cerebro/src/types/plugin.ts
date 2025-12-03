import type { Cli } from "./cli";
import type { Toolbox } from "./toolbox";

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext<T extends Console = Console> {
    /** The CLI instance */
    cli: Cli<T>;
    /** Current working directory */
    cwd: string;
    /** Logger instance */
    logger: T;
}

/**
 * Plugin interface with lifecycle hooks
 */
export interface Plugin<T extends Console = Console> {
    /**
     * Called after command execution completes successfully
     * @param toolbox The command toolbox
     * @param result The result returned by the command
     */
    afterCommand?: (toolbox: Toolbox<T>, result: unknown) => Promise<void> | void;

    /**
     * Called before command execution
     * @param toolbox The command toolbox
     */
    beforeCommand?: (toolbox: Toolbox<T>) => Promise<void> | void;

    /** Plugin dependencies (other plugin names that must be loaded first) */
    dependencies?: string[];

    /** Plugin description */
    description?: string;

    /**
     * Called during command execution (for plugins that extend toolbox functionality)
     * @param toolbox The command toolbox
     */
    execute?: (toolbox: Toolbox<T>) => Promise<void> | void;

    /**
     * Called once during plugin initialization
     * @param context The plugin context
     */
    init?: (context: PluginContext<T>) => Promise<void> | void;

    /** Plugin name (must be unique) */
    name: string;

    /**
     * Called when an error occurs during command execution
     * @param error The error that occurred
     * @param toolbox The command toolbox
     */
    onError?: (error: Error, toolbox: Toolbox<T>) => Promise<void> | void;

    /** Plugin version */
    version?: string;
}
