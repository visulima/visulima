import type PluginManager from "../plugin-manager";
import type { Command as ICommand, OptionDefinition } from "./command";
import type { Plugin } from "./plugin";

export type CommandSection = { footer?: string; header?: string };

export type ExtendedLogger = Console & {
    debug: (...args: any[]) => void;
};

export type CliRunOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;

    /**
     * Whether to automatically dispose/cleanup the CLI instance after execution
     * @default true
     */
    autoDispose?: boolean;
    shouldExitProcess?: boolean;
};

export type RunCommandOptions = {
    /**
     * Additional options to merge into the command's options
     * @default {}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;

    /**
     * Command line arguments to pass to the command
     * @default []
     */
    argv?: string[];
};

export interface Cli {
    /**
     * Add an arbitrary command to the CLI.
     * @param command The command to add.
     * @returns self
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addCommand: <OD extends OptionDefinition<any> = any>(command: ICommand<OD>) => this;

    /**
     * Add a plugin to extend the CLI functionality
     * @param plugin The plugin to add.
     * @returns self
     */
    addPlugin: (plugin: Plugin) => this;

    /**
     * Disposes the CLI instance and cleans up resources
     * @returns void
     */
    dispose: () => void;

    getCliName: () => string;

    getCommands: () => Map<string, ICommand>;

    getCommandSection: () => CommandSection;

    getCwd: () => string;

    getPackageName: () => string | undefined;

    getPackageVersion: () => string | undefined;

    /**
     * Get the plugin manager instance
     * @returns The plugin manager
     */
    getPluginManager: () => PluginManager;

    run: (extraOptions?: CliRunOptions) => Promise<void>;

    /**
     * Runs a command programmatically from within another command.
     * This allows commands to call other commands during execution.
     * @param commandName The name of the command to execute
     * @param options Optional options including argv and other command options
     * @returns A promise that resolves with the command's result
     * @throws {CommandNotFoundError} If the specified command doesn't exist
     * @throws {CommandValidationError} If command arguments are invalid
     * @example
     * ```typescript
     * cli.addCommand({
     *   name: 'deploy',
     *   execute: async ({ runtime, logger }) => {
     *     logger.info('Building...');
     *     await runtime.runCommand('build', { argv: ['--production'] });
     *
     *     logger.info('Testing...');
     *     await runtime.runCommand('test', { argv: ['--coverage'] });
     *   }
     * });
     * ```
     */
    runCommand: (commandName: string, options?: RunCommandOptions) => Promise<unknown>;

    setCommandSection: (commandSection: CommandSection) => this;

    /**
     * Set a default command, to display a different command if cli is call without command.
     * @param commandName
     * @returns self
     */
    setDefaultCommand: (commandName: string) => this;
}

/**
 * Any of the output types [[OUTPUT_NORMAL]], [[OUTPUT_RAW]] and [[OUTPUT_PLAIN]].
 */
export type OutputType = 1 | 2 | 4;

/**
 * Any of the verbosity types
 * [[VERBOSITY_QUIET]], [[VERBOSITY_NORMAL]], [[VERBOSITY_VERBOSE]] and [[VERBOSITY_DEBUG]].
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type VERBOSITY_LEVEL = 16 | 32 | 64 | 128 | 256;
