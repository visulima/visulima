import type { Pail } from "@visulima/pail/server";

import type { Cli } from "./cli";
import type { Toolbox } from "./toolbox";

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
    /** The CLI instance */
    cli: Cli;
    /** Current working directory */
    cwd: string;
    /** Logger instance */
    logger: Pail;
}

/**
 * Plugin interface with lifecycle hooks
 */
export interface Plugin {
    /**
     * Called after command execution completes successfully
     * @param toolbox The command toolbox
     * @param result The result returned by the command
     */
    afterCommand?: (toolbox: Toolbox, result: unknown) => Promise<void> | void;

    /**
     * Called before command execution
     * @param toolbox The command toolbox
     */
    beforeCommand?: (toolbox: Toolbox) => Promise<void> | void;

    /** Plugin dependencies (other plugin names that must be loaded first) */
    dependencies?: string[];

    /** Plugin description */
    description?: string;

    /**
     * Called during command execution (for plugins that extend toolbox functionality)
     * @param toolbox The command toolbox
     */
    execute?: (toolbox: Toolbox) => Promise<void> | void;

    /**
     * Called once during plugin initialization
     * @param context The plugin context
     */
    init?: (context: PluginContext) => Promise<void> | void;

    /** Plugin name (must be unique) */
    name: string;

    /**
     * Called when an error occurs during command execution
     * @param error The error that occurred
     * @param toolbox The command toolbox
     */
    onError?: (error: Error, toolbox: Toolbox) => Promise<void> | void;

    /** Plugin version */
    version?: string;
}
