import { argv as process_argv, cwd as process_cwd, env, execArgv, execPath, exit } from "node:process";

import type { CommandLineOptions } from "@visulima/command-line-args";

import HelpCommand from "./commands/help-command";
import { VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "./constants";
import defaultOptions from "./default-options";
import CerebroError from "./errors/cerebro-error";
import CommandNotFoundError from "./errors/command-not-found-error";
import CommandValidationError from "./errors/command-validation-error";
import ConflictingOptionsError from "./errors/conflicting-options-error";
import PluginManager from "./plugin-manager";
import type { Cli as ICli, CliRunOptions, CommandSection as ICommandSection, ExtendedLogger, RunCommandOptions } from "./types/cli";
import type { Command as ICommand, OptionDefinition } from "./types/command";
import type { Plugin } from "./types/plugin";
import type { Toolbox as IToolbox } from "./types/toolbox";
import mapOptionTypeLabel from "./util/arg-processing/map-option-type-label";
import commandLineCommands from "./util/command-line-commands";
import { executeCommand, prepareToolbox, processCommandArgs } from "./util/command-processing/command-processor";
import { validateConflictingOptions, validateDuplicateOptions, validateRequiredOptions } from "./util/command-processing/command-validation";
import { getCommandPathKey, getFullCommandPath, parseNestedCommand } from "./util/command-processing/nested-command-parser";
import { addNegatableOptions, mapImpliedOptions, mapNegatableOptions, processOptionNames } from "./util/command-processing/option-processor";
import findAlternatives from "./util/general/find-alternatives";
import parseRawCommand from "./util/general/parse-raw-command";
import registerExceptionHandler from "./util/general/register-exception-handler";
import { validateCommandName, validateNonEmptyString, validateObject, validateStringArray } from "./util/general/validate-input";
import { sanitizeArguments } from "./util/security";

// Pre-compiled regex patterns for option detection (performance optimization)
const OPTION_REGEX_SHORT = /^-([^\d-])$/;
const OPTION_REGEX_LONG = /^--(\S+)/;
const OPTION_REGEX_COMBINED = /^-([^\d-]{2,})$/;

// Helper to check if a string is an option flag
const isOption = (argument: string): boolean => OPTION_REGEX_SHORT.test(argument) || OPTION_REGEX_LONG.test(argument) || OPTION_REGEX_COMBINED.test(argument);

export type CliOptions<T extends ExtendedLogger = ExtendedLogger> = {
    argv?: ReadonlyArray<string>;
    cwd?: string;
    logger?: T;
    packageName?: string;
    packageVersion?: string;
};

export class Cli<T extends ExtendedLogger = ExtendedLogger> implements ICli {
    readonly #logger: T;

    readonly #options: CliOptions<T>;

    readonly #argv: ReadonlyArray<string>;

    readonly #cwd: string;

    readonly #cliName: string;

    readonly #packageVersion: string | undefined;

    readonly #packageName: string | undefined;

    readonly #pluginManager: PluginManager;

    readonly #commands: Map<string, ICommand>;

    /** Map of command path keys to full command paths for nested command lookup */
    readonly #commandPaths: Map<string, string[]>;

    /**
     * Map of commands keyed by their full path string (e.g., "deploy staging")
     * This allows correct resolution when different paths share the same leaf name
     */
    readonly #commandsByPath: Map<string, ICommand>;

    #defaultCommand: string;

    #commandSection: ICommandSection;

    #pluginsInitialized = false;

    #exceptionHandlerCleanup?: () => void;

    /** Cached arrays for command lookup performance */
    #cachedCommandPathKeys?: string[];

    #cachedCommandNames?: string[];

    #cachedAllCommandPaths?: string[];

    /**
     * Gets all command path keys (cached for performance).
     * @returns Array of command path keys
     */
    #getCommandPathKeys(): string[] {
        if (this.#cachedCommandPathKeys === undefined) {
            this.#cachedCommandPathKeys = [...this.#commandPaths.keys()];
        }

        return this.#cachedCommandPathKeys;
    }

    /**
     * Gets all command names (cached for performance).
     * @returns Array of command names
     */
    #getCommandNames(): string[] {
        if (this.#cachedCommandNames === undefined) {
            this.#cachedCommandNames = [...this.#commands.keys()];
        }

        return this.#cachedCommandNames;
    }

    /**
     * Gets all command paths combined (cached for performance).
     * @returns Array of all command paths
     */
    #getAllCommandPaths(): string[] {
        if (this.#cachedAllCommandPaths === undefined) {
            this.#cachedAllCommandPaths = [...this.#getCommandPathKeys(), ...this.#getCommandNames()];
        }

        return this.#cachedAllCommandPaths;
    }

    /**
     * Invalidates cached command arrays (call when commands are added/removed).
     */
    #invalidateCommandCache(): void {
        this.#cachedCommandPathKeys = undefined;
        this.#cachedCommandNames = undefined;
        this.#cachedAllCommandPaths = undefined;
    }

    /**
     * Common command execution logic shared between run() and runCommand()
     * This eliminates code duplication and improves maintainability
     */
    #executeCommandInternal(
        command: ICommand,
        commandArguments: string[],
        extraOptions: Record<string, unknown>,
        pathKey: string,
    ): {
        arguments_: ReturnType<typeof processCommandArgs>["arguments_"];
        booleanValues: Record<string, unknown>;
        commandArgs: CommandLineOptions;
        parsedArgs: CommandLineOptions;
        toolbox: IToolbox;
    } {
        this.#logger.debug(`command '${pathKey}' found, parsing command args: ${commandArguments.join(", ")}`);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { arguments_, booleanValues, parsedArgs } = processCommandArgs(command, commandArguments, defaultOptions as OptionDefinition<unknown>[]);

        // eslint-disable-next-line no-underscore-dangle
        const commandArgs = { ...parsedArgs, _all: { ...parsedArgs._all, ...booleanValues } } as typeof parsedArgs;

        validateRequiredOptions(arguments_, commandArgs, command);

        // Prepare the execute toolbox
        const toolbox = prepareToolbox(command, parsedArgs, booleanValues, extraOptions);

        // Attach the runtime
        toolbox.runtime = this as ICli;
        toolbox.argv = this.#argv;

        // Process options
        mapNegatableOptions(toolbox, command);
        mapImpliedOptions(toolbox, command);

        validateConflictingOptions(arguments_, toolbox.options, command);

        this.#logger.debug("command options parsed from options:");
        // eslint-disable-next-line unicorn/no-null
        this.#logger.debug(JSON.stringify(toolbox.options, null, 2));
        this.#logger.debug("command argument parsed from argument:");
        // eslint-disable-next-line unicorn/no-null
        this.#logger.debug(JSON.stringify(toolbox.argument, null, 2));

        return { arguments_, booleanValues, commandArgs, parsedArgs, toolbox };
    }

    /**
     * Create a new CLI instance.
     * @param cliName
     * @param options The options for the CLI.
     * @param options.argv The command line arguments.
     * @param options.cwd The current working directory.
     * @param options.logger The logger to use.
     * @param options.packageName
     * @param options.packageVersion
     */
    public constructor(cliName: string, options: CliOptions<T> = {}) {
        // Validate inputs
        this.#cliName = validateNonEmptyString(cliName, "CLI name");

        this.#options = {
            argv: process_argv,
            cwd: process_cwd(),
            ...options,
        };

        // Validate options
        if (this.#options.argv && !Array.isArray(this.#options.argv)) {
            throw new CerebroError("CLI argv option must be an array of strings", "INVALID_INPUT", { argv: this.#options.argv });
        }

        if (this.#options.cwd && typeof this.#options.cwd !== "string") {
            throw new CerebroError("CLI cwd option must be a string", "INVALID_INPUT", { cwd: this.#options.cwd });
        }

        if (this.#options.packageName && typeof this.#options.packageName !== "string") {
            throw new CerebroError("CLI packageName option must be a string", "INVALID_INPUT", { packageName: this.#options.packageName });
        }

        if (this.#options.packageVersion && typeof this.#options.packageVersion !== "string") {
            throw new CerebroError("CLI packageVersion option must be a string", "INVALID_INPUT", { packageVersion: this.#options.packageVersion });
        }

        this.#argv = sanitizeArguments(parseRawCommand(this.#options.argv as string[]));

        // Set verbosity level from command line flags
        if (this.#argv.includes("--quiet") || this.#argv.includes("-q")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_QUIET);
        } else if (this.#argv.includes("--verbose") || this.#argv.includes("-v")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_VERBOSE);
        } else if (this.#argv.includes("--debug") || this.#argv.includes("-vvv") || Object.hasOwn(env, "DEBUG")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_DEBUG);
        } else {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_NORMAL);
        }

        if (typeof this.#options.logger === "object") {
            this.#logger = this.#options.logger;
        } else {
            this.#logger = {
                ...console,
                debug: (...args) => {
                    if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
                        // eslint-disable-next-line no-console
                        console.debug(...args);
                    }
                },
            } as T;
        }

        this.#packageVersion = this.#options.packageVersion;
        this.#packageName = this.#options.packageName;
        this.#cwd = this.#options.cwd as string;
        this.#defaultCommand = "help";
        this.#commandSection = {
            header: `${this.#cliName}${this.#packageVersion ? ` v${this.#packageVersion}` : ""}`,
        };

        this.#commands = new Map<string, ICommand>();
        this.#commandPaths = new Map<string, string[]>();
        this.#commandsByPath = new Map<string, ICommand>();

        this.#pluginManager = new PluginManager(this.#logger);

        this.#pluginManager.register({
            description: "Attaches the logger to the toolbox",
            execute: (toolbox) => {
                // eslint-disable-next-line no-param-reassign
                toolbox.logger = this.#logger;
            },
            name: "logger",
        });

        this.#exceptionHandlerCleanup = registerExceptionHandler(this.#logger);
    }

    /**
     * Sets the command section configuration for help display.
     *
     * This affects how the CLI name and version are displayed in help output.
     * @param commandSection The command section configuration
     * @returns The CLI instance for method chaining
     * @example
     * ```typescript
     * cli.setCommandSection({
     *   header: 'My App v2.0.0',
     *   footer: 'For more info, visit https://example.com'
     * });
     * ```
     */
    public setCommandSection(commandSection: ICommandSection): this {
        this.#commandSection = commandSection;

        return this;
    }

    /**
     * Gets the current command section configuration.
     * @returns The command section configuration
     */
    public getCommandSection(): ICommandSection {
        return this.#commandSection;
    }

    /**
     * Sets the default command to run when no command is specified.
     *
     * By default, this is set to 'help'. The command must already be registered
     * with the CLI instance.
     * @param commandName The name of the default command
     * @returns The CLI instance for method chaining
     * @example
     * ```typescript
     * cli.setDefaultCommand('start');
     * ```
     */
    public setDefaultCommand(commandName: string): this {
        this.#defaultCommand = commandName;

        return this;
    }

    /**
     * Gets the current default command.
     * @returns The name of the default command
     */
    public get defaultCommand(): string {
        return this.#defaultCommand;
    }

    /**
     * Adds a command to the CLI.
     *
     * Commands define the available operations that users can execute.
     * Each command can have options, arguments, aliases, and custom execution logic.
     * @template OD - The option definition type for the command
     * @param command The command configuration object
     * @returns The CLI instance for method chaining
     * @throws {CerebroError} If the command name already exists or validation fails
     * @example
     * ```typescript
     * cli.addCommand({
     *   name: 'build',
     *   description: 'Build the project',
     *   options: [
     *     {
     *       name: 'output',
     *       alias: 'o',
     *       type: String,
     *       description: 'Output directory'
     *     }
     *   ],
     *   execute: ({ options }) => {
     *     console.log(`Building to ${options.output || 'dist'}`);
     *   }
     * });
     * ```
     */
    public addCommand<OD extends OptionDefinition<unknown> = OptionDefinition<unknown>>(command: ICommand<OD>): this {
        // Validate command input
        validateObject(command, "Command");
        validateCommandName(command.name);

        if (command.alias) {
            if (typeof command.alias === "string") {
                validateCommandName(command.alias);
            } else {
                validateStringArray(command.alias, "Command alias").forEach((alias) => validateCommandName(alias));
            }
        }

        if (command.argument) {
            validateObject(command.argument, "Command argument");
        }

        if (command.options) {
            validateObject(command.options, "Command options");
        }

        // Validate commandPath if provided
        if (command.commandPath) {
            validateStringArray(command.commandPath, "Command commandPath");
            command.commandPath.forEach((segment) => {
                validateCommandName(segment);
            });
        }

        // Generate full command path
        const fullPath = getFullCommandPath(command.name, command.commandPath);
        const pathKey = getCommandPathKey(fullPath);

        // Check for duplicate commands (by full path)
        if (this.#commandPaths.has(pathKey)) {
            throw new CerebroError(`Command with path "${pathKey}" already exists`, "DUPLICATE_COMMAND", {
                commandName: command.name,
                commandPath: command.commandPath,
            });
        }

        // Also check for duplicate by name (for backward compatibility)
        if (this.#commands.has(command.name) && !command.commandPath) {
            throw new CerebroError(`Command with name "${command.name}" already exists`, "DUPLICATE_COMMAND", { commandName: command.name });
        }

        command.options?.map((option) => mapOptionTypeLabel<OD>(option));

        validateDuplicateOptions(command);
        addNegatableOptions(command as { name: string; options?: OptionDefinition<unknown>[] });
        processOptionNames(command as { options?: OptionDefinition<unknown>[] });

        // Pre-compute validation metadata for runtime performance
        // This moves validation overhead from every execution to one-time registration
        if (command.options) {
            // Pre-compute conflicting options (used in validateConflictingOptions)
            // eslint-disable-next-line no-param-reassign, no-underscore-dangle
            command.__conflictingOptions__ = command.options.filter((option) => option.conflicts !== undefined);

            // Pre-compute required options (used in validateRequiredOptions)
            // eslint-disable-next-line no-param-reassign, no-underscore-dangle
            command.__requiredOptions__ = command.options.filter((option) => option.required === true);
        }

        // Store command by both name (for backward compatibility) and full path
        this.#commands.set(command.name, command);
        this.#commandPaths.set(pathKey, fullPath);
        // Store command by full path key for correct nested command resolution
        this.#commandsByPath.set(pathKey, command);

        // Invalidate cache when commands are added
        this.#invalidateCommandCache();

        if (command.alias !== undefined) {
            let aliases: string[] = command.alias as string[];

            if (typeof command.alias === "string") {
                aliases = [command.alias];
            }

            aliases.forEach((alias) => {
                this.#logger.debug("adding alias", alias);

                if (this.#commands.has(alias)) {
                    throw new CerebroError(`Command alias "${alias}" conflicts with existing command`, "DUPLICATE_COMMAND", {
                        alias,
                        commandName: command.name,
                    });
                } else {
                    this.#commands.set(alias, command);
                }
            });
        }

        return this;
    }

    /**
     * Adds a plugin to extend the CLI functionality.
     *
     * Plugins can hook into various lifecycle events and modify the toolbox
     * to provide additional functionality to commands.
     * @param plugin The plugin to register
     * @returns The CLI instance for method chaining
     * @example
     * ```typescript
     * cli.addPlugin({
     *   name: 'logger',
     *   execute: (toolbox) => {
     *     toolbox.logger = createCustomLogger();
     *   }
     * });
     * ```
     */
    public addPlugin(plugin: Plugin): this {
        this.#pluginManager.register(plugin);

        return this;
    }

    /**
     * Gets the plugin manager instance for advanced plugin management.
     * @returns The plugin manager instance
     */
    public getPluginManager(): PluginManager {
        return this.#pluginManager;
    }

    /**
     * Gets the CLI application name.
     */
    public getCliName(): string {
        return this.#cliName;
    }

    /**
     * Gets the package version if configured.
     * @returns The package version or undefined
     */
    public getPackageVersion(): string | undefined {
        return this.#packageVersion;
    }

    /**
     * Gets the package name if configured.
     * @returns The package name or undefined
     */
    public getPackageName(): string | undefined {
        return this.#packageName;
    }

    /**
     * Gets all registered commands.
     * @returns A map of command names to command definitions
     */
    public getCommands(): Map<string, ICommand> {
        return this.#commands;
    }

    /**
     * Gets the current working directory.
     * @returns The current working directory path
     */
    public getCwd(): string {
        return this.#cwd;
    }

    /**
     * Disposes the CLI instance and cleans up resources.
     *
     * This method removes event listeners and performs cleanup to prevent memory leaks.
     * Call this method when the CLI instance is no longer needed, especially in long-running
     * processes or when creating multiple CLI instances.
     * @example
     * ```typescript
     * const cli = new Cerebro('my-app');
     * // ... use the cli
     * cli.dispose(); // Clean up when done
     * ```
     */
    public dispose(): void {
        // Remove exception handlers to prevent memory leaks
        this.#exceptionHandlerCleanup?.();
    }

    /**
     * Runs the CLI application.
     *
     * This method parses command line arguments, executes the appropriate command,
     * and handles the complete CLI lifecycle including plugin initialization,
     * error handling, process termination, and automatic cleanup.
     * @param extraOptions Additional options to pass to commands
     * @param extraOptions.shouldExitProcess Whether to exit the process after execution (default: true)
     * @param extraOptions.autoDispose Whether to automatically cleanup/dispose resources after execution (default: true)
     * @returns A promise that resolves when execution completes
     * @throws {CommandNotFoundError} If the specified command doesn't exist
     * @throws {CommandValidationError} If command arguments are invalid
     * @throws {ConflictingOptionsError} If conflicting options are provided
     * @example
     * ```typescript
     * // Run with default behavior (exits process and auto-disposes)
     * await cli.run();
     *
     * // Run without exiting (for testing)
     * await cli.run({ shouldExitProcess: false });
     *
     * // Run without auto-disposing (for reuse)
     * await cli.run({ autoDispose: false });
     * ```
     */

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async run(extraOptions: CliRunOptions = {}): Promise<void> {
        const { autoDispose = true, shouldExitProcess = true, ...otherExtraOptions } = extraOptions;

        if (!this.#commands.has("help")) {
            this.addCommand(new HelpCommand(this.#commands));
        }

        // Use cached arrays for performance
        const commandNames = this.#getCommandNames();
        // Use existing Map directly instead of creating a new one
        const commandPathMap = this.#commandPaths;

        let parsedCommandPath: string[] | undefined;
        let remainingArgv: string[] = [...this.#argv];

        this.#logger.debug(`process.execPath: ${execPath}`);
        this.#logger.debug(`process.execArgv: ${execArgv.join(" ")}`);
        this.#logger.debug(`process.argv: ${process_argv.join(" ")}`);

        // Try to parse nested command first
        const nestedResult = parseNestedCommand(commandPathMap, [...this.#argv]);

        if (nestedResult.commandPath) {
            // Found a nested command match
            parsedCommandPath = nestedResult.commandPath;
            remainingArgv = nestedResult.argv;
        } else {
            // If nested parsing failed but we have multiple tokens, try to form the attempted path
            if (this.#argv.length > 1 && this.#argv[0] && this.#argv[1] && !isOption(this.#argv[0]) && !isOption(this.#argv[1])) {
                // This looks like a nested command attempt that failed
                const attemptedPath: string[] = [];
                let i = 0;

                while (i < this.#argv.length && this.#argv[i] && !isOption(this.#argv[i])) {
                    attemptedPath.push(this.#argv[i]);
                    i += 1;
                }

                const attemptedPathKey = getCommandPathKey(attemptedPath);

                // Only throw error if no flat command matches the first token
                if (attemptedPath[0] && !commandNames.includes(attemptedPath[0])) {
                    const allCommandPaths = this.#getAllCommandPaths();
                    const alternatives = findAlternatives(attemptedPathKey, allCommandPaths);

                    throw new CommandNotFoundError(attemptedPathKey, alternatives);
                }
            }

            // Fall back to flat command parsing for backward compatibility
            let parsedArguments: { argv: string[]; command: string | null | undefined };

            try {
                // eslint-disable-next-line unicorn/no-null
                parsedArguments = commandLineCommands([null, ...commandNames], [...this.#argv]);
            } catch (error) {
                // CLI needs a valid command name to do anything. If the given
                // command is invalid, throw a structured error with suggestions.
                if (error instanceof Error && error.name === "INVALID_COMMAND" && "command" in error) {
                    const invalidCommand = (error as { command: string }).command;
                    const allCommandPaths = this.#getAllCommandPaths();
                    const alternatives = findAlternatives(invalidCommand, allCommandPaths);

                    throw new CommandNotFoundError(invalidCommand, alternatives);
                }

                throw error;
            }

            if (parsedArguments.command) {
                parsedCommandPath = [parsedArguments.command];
                remainingArgv = parsedArguments.argv;
            }
        }

        // Use default command if no command was parsed
        if (!parsedCommandPath) {
            if (this.#defaultCommand) {
                parsedCommandPath = [this.#defaultCommand];
            } else {
                const allCommandPaths = this.#getAllCommandPaths();

                throw new CommandNotFoundError("", allCommandPaths);
            }
        }

        // Find the command by its full path
        const pathKey = getCommandPathKey(parsedCommandPath);
        const storedPath = this.#commandPaths.get(pathKey);

        // Use path-based lookup when stored path exists, fallback to leaf name for backward compatibility
        let command: ICommand | undefined;

        if (storedPath) {
            // Resolve by full path key (handles cases where different paths share same leaf name)
            command = this.#commandsByPath.get(pathKey);

            // Verify the command matches the expected path
            if (!command || getCommandPathKey(storedPath) !== pathKey) {
                const allCommandPaths = this.#getAllCommandPaths();
                const alternatives = findAlternatives(pathKey, allCommandPaths);

                throw new CommandNotFoundError(pathKey, alternatives);
            }
        } else {
            // Fallback to leaf name lookup (backward compatibility for flat commands)
            const commandName = parsedCommandPath[parsedCommandPath.length - 1];

            command = commandName ? this.#commands.get(commandName) : undefined;

            if (!command) {
                const allCommandPaths = this.#getAllCommandPaths();
                const alternatives = findAlternatives(pathKey, allCommandPaths);

                throw new CommandNotFoundError(pathKey, alternatives);
            }
        }

        if (typeof command.execute !== "function") {
            this.#logger.error(`Command "${command.name}" has no function to execute.`);

            return shouldExitProcess ? exit(1) : undefined;
        }

        const commandArguments = remainingArgv;

        // Use shared execution logic
        const { commandArgs, toolbox } = this.#executeCommandInternal(command, commandArguments, otherExtraOptions, pathKey);

        try {
            // initialize plugins on first run (fast path: skip if no plugins registered)
            if (!this.#pluginsInitialized && this.#pluginManager.hasPlugins()) {
                await this.#pluginManager.init({
                    cli: this as ICli,
                    cwd: this.#cwd,
                    logger: this.#logger,
                });

                this.#pluginsInitialized = true;
            }

            // execute plugins that need to modify the toolbox (fast path: automatically skips if no plugins)
            await this.#pluginManager.executeLifecycle("execute", toolbox);

            // Execute beforeCommand hooks
            await this.#pluginManager.executeLifecycle("beforeCommand", toolbox);

            // Check for special flags and route to appropriate commands
            let result: unknown;

            if (commandArgs.global?.help) {
                const helpCommand = this.#commands.get("help");

                if (!helpCommand) {
                    throw new CerebroError("Help command not found", "COMMAND_NOT_FOUND");
                }

                result = await executeCommand(helpCommand, toolbox, commandArgs);
            } else if (commandArgs.global?.version || commandArgs.global?.V) {
                const versionCommand = this.#commands.get("version");

                if (!versionCommand) {
                    throw new CerebroError("Version command not found", "COMMAND_NOT_FOUND");
                }

                result = await executeCommand(versionCommand, toolbox, commandArgs);
            } else {
                // Execute the regular command
                result = await executeCommand(command, toolbox, commandArgs);
            }

            // Execute afterCommand hooks
            await this.#pluginManager.executeLifecycle("afterCommand", toolbox, result);

            return shouldExitProcess ? exit(0) : undefined;
        } catch (error) {
            // Execute error handlers
            await this.#pluginManager.executeErrorHandlers(error as Error, toolbox);

            // Re-throw the error
            throw error;
        } finally {
            // Automatically clean up resources to prevent memory leaks
            if (autoDispose) {
                this.dispose();
            }
        }
    }

    /**
     * Runs a command programmatically from within another command.
     *
     * This method allows commands to call other commands during execution,
     * enabling composition of commands and reusable command logic.
     * @param commandName The name of the command to execute
     * @param options Optional options including argv and other command options
     * @returns A promise that resolves with the command's result
     * @throws {CommandNotFoundError} If the specified command doesn't exist
     * @throws {CerebroError} If command validation fails
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
    public async runCommand(commandName: string, options: RunCommandOptions = {}): Promise<unknown> {
        const { argv: providedArgv = [], ...extraOptions } = options;

        // Validate command name
        validateNonEmptyString(commandName, "Command name");

        // Try to find command by full path first (for nested commands)
        // commandName can be either a simple name or a space-separated path
        const commandPath = commandName.split(" ").filter(Boolean);
        const pathKey = getCommandPathKey(commandPath);
        const storedPath = this.#commandPaths.get(pathKey);

        let command: ICommand | undefined;

        if (storedPath) {
            // Resolve by full path key (handles cases where different paths share same leaf name)
            command = this.#commandsByPath.get(pathKey);
        } else {
            // Fall back to simple name lookup (backward compatibility)
            command = this.#commands.get(commandName);
        }

        if (!command) {
            const allCommandPaths = this.#getAllCommandPaths();
            const alternatives = findAlternatives(pathKey || commandName, allCommandPaths);

            throw new CommandNotFoundError(commandName, alternatives);
        }

        if (typeof command.execute !== "function") {
            throw new CerebroError(`Command "${command.name}" has no function to execute`, "INVALID_COMMAND", { commandName: command.name });
        }

        // Sanitize and parse arguments
        const sanitizedArgv = sanitizeArguments(providedArgv);
        const commandArguments = [...sanitizedArgv];

        this.#logger.debug(`running command '${commandName}' programmatically with args: ${commandArguments.join(", ")}`);

        // Use shared execution logic
        const { commandArgs, toolbox } = this.#executeCommandInternal(command, commandArguments, extraOptions, pathKey || commandName);

        // Initialize plugins if needed (fast path: skip if no plugins registered)
        if (!this.#pluginsInitialized && this.#pluginManager.hasPlugins()) {
            await this.#pluginManager.init({
                cli: this as ICli,
                cwd: this.#cwd,
                logger: this.#logger,
            });

            this.#pluginsInitialized = true;
        }

        // Execute plugins that need to modify the toolbox (fast path: automatically skips if no plugins)
        await this.#pluginManager.executeLifecycle("execute", toolbox);

        try {
            // Execute beforeCommand hooks
            await this.#pluginManager.executeLifecycle("beforeCommand", toolbox);

            // Check for special flags and route to appropriate commands
            let result: unknown;

            if (commandArgs.global?.help) {
                const helpCommand = this.#commands.get("help");

                if (!helpCommand) {
                    throw new CerebroError("Help command not found", "COMMAND_NOT_FOUND");
                }

                result = await executeCommand(helpCommand, toolbox, commandArgs);
            } else if (commandArgs.global?.version || commandArgs.global?.V) {
                const versionCommand = this.#commands.get("version");

                if (!versionCommand) {
                    throw new CerebroError("Version command not found", "COMMAND_NOT_FOUND");
                }

                result = await executeCommand(versionCommand, toolbox, commandArgs);
            } else {
                // Execute the regular command
                result = await executeCommand(command, toolbox, commandArgs);
            }

            // Execute afterCommand hooks
            await this.#pluginManager.executeLifecycle("afterCommand", toolbox, result);

            return result;
        } catch (error) {
            // Execute error handlers
            await this.#pluginManager.executeErrorHandlers(error as Error, toolbox);

            // Re-throw the error
            throw error;
        }
    }
}
