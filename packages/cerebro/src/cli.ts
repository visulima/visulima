import type { CommandLineOptions } from "@visulima/command-line-args";

import HelpCommand from "./commands/help-command";
import { VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "./constants";
import defaultOptions from "./default-options";
import CerebroError from "./errors/cerebro-error";
import CommandNotFoundError from "./errors/command-not-found-error";
import PluginManager from "./plugin-manager";
import type { Cli as ICli, CliRunOptions, CommandSection as ICommandSection, RunCommandOptions } from "./types/cli";
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
import { exitProcess, getArgv as getRuntimeArgv, getCwd as getRuntimeCwd, getEnv, getExecArgv, getExecPath } from "./util/general/runtime-process";
import { validateCommandName, validateNonEmptyString, validateObject, validateStringArray } from "./util/general/validate-input";
import { sanitizeArguments } from "./util/security";

// eslint-disable-next-line regexp/no-unused-capturing-group
const OPTION_REGEX_SHORT: RegExp = /^-([^\d-])$/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const OPTION_REGEX_LONG: RegExp = /^--(\S+)/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const OPTION_REGEX_COMBINED: RegExp = /^-([^\d-]{2,})$/;

const isOption = (argument: string): boolean => OPTION_REGEX_SHORT.test(argument) || OPTION_REGEX_LONG.test(argument) || OPTION_REGEX_COMBINED.test(argument);

export type CliOptions<T extends Console = Console> = {
    argv?: ReadonlyArray<string>;
    cwd?: string;
    logger?: T;
    packageName?: string;
    packageVersion?: string;
};

export class Cli<T extends Console = Console> implements ICli<T> {
    readonly #logger: T;

    readonly #options: CliOptions<T>;

    #argv?: ReadonlyArray<string>;

    readonly #cwd: string;

    readonly #cliName: string;

    readonly #packageVersion: string | undefined;

    readonly #packageName: string | undefined;

    #pluginManager?: PluginManager<T>;

    readonly #commands: Map<string, ICommand<OptionDefinition<unknown>, T>>;

    /** Map of command path keys to full command paths for nested command lookup */
    readonly #commandPaths: Map<string, string[]>;

    /**
     * Map of commands keyed by their full path string (e.g., "deploy staging")
     * This allows correct resolution when different paths share the same leaf name
     */
    readonly #commandsByPath: Map<string, ICommand<OptionDefinition<unknown>, T>>;

    #defaultCommand: string;

    #commandSection: ICommandSection;

    #pluginsInitialized = false;

    #exceptionHandlerCleanup?: () => void;

    #exceptionHandlerRegistered = false;

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
     * Gets parsed argv.
     * @returns Parsed and sanitized argv array
     */
    #getArgv(): ReadonlyArray<string> {
        if (this.#argv === undefined) {
            const rawArgv = parseRawCommand(this.#options.argv as string[]);

            this.#argv = sanitizeArguments(rawArgv);

            this.#setVerbosityLevel();
        }

        return this.#argv;
    }

    /**
     * Sets verbosity level from argv flags.
     */
    #setVerbosityLevel(): void {
        if (!this.#argv) {
            return;
        }

        const env = getEnv();
        let verbositySet = false;

        for (const argument of this.#argv) {
            if (argument === "--quiet" || argument === "-q") {
                env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_QUIET);
                verbositySet = true;
                break;
            }

            if (argument === "--verbose" || argument === "-v") {
                env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_VERBOSE);
                verbositySet = true;
                break;
            }

            if (argument === "--debug" || argument === "-vvv") {
                env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_DEBUG);
                verbositySet = true;
                break;
            }
        }

        if (!verbositySet) {
            env.CEREBRO_OUTPUT_LEVEL = Object.hasOwn(env, "DEBUG") ? String(VERBOSITY_DEBUG) : String(VERBOSITY_NORMAL);
        }
    }

    /**
     * Registers exception handlers.
     */
    #ensureExceptionHandlers(): void {
        if (!this.#exceptionHandlerRegistered) {
            this.#exceptionHandlerCleanup = registerExceptionHandler(this.#logger);
            this.#exceptionHandlerRegistered = true;
        }
    }

    /**
     * Common command execution logic shared between run() and runCommand().
     */
    #executeCommandInternal(
        command: ICommand<OptionDefinition<unknown>, T>,
        commandArguments: string[],
        extraOptions: Record<string, unknown>,
        pathKey: string,
    ): {
        arguments_: ReturnType<typeof processCommandArgs>["arguments_"];
        booleanValues: Record<string, unknown>;
        commandArgs: CommandLineOptions;
        parsedArgs: CommandLineOptions;
        toolbox: IToolbox<T>;
    } {
        this.#logger.debug(`command '${pathKey}' found, parsing command args: ${commandArguments.join(", ")}`);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { arguments_, booleanValues, parsedArgs } = processCommandArgs(command, commandArguments, defaultOptions as OptionDefinition<unknown>[]);

        const hasBooleanValues = Object.keys(booleanValues).length > 0;

        const commandArgs = hasBooleanValues ? ({ ...parsedArgs, _all: { ...parsedArgs._all, ...booleanValues } } as typeof parsedArgs) : parsedArgs;

        validateRequiredOptions(arguments_, commandArgs, command);

        const toolbox = prepareToolbox<OptionDefinition<unknown>, T>(command, parsedArgs, booleanValues, extraOptions);

        toolbox.runtime = this as ICli<T>;
        toolbox.argv = this.#getArgv();

        const hasOptions = command.options && command.options.length > 0;

        if (hasOptions) {
            mapNegatableOptions(toolbox, command);
            mapImpliedOptions(toolbox, command);
        }

        validateConflictingOptions(arguments_, toolbox.options, command);

        const env = getEnv();

        if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
            this.#logger.debug("command options parsed from options:");
            // eslint-disable-next-line unicorn/no-null
            this.#logger.debug(JSON.stringify(toolbox.options, null, 2));
            this.#logger.debug("command argument parsed from argument:");
            // eslint-disable-next-line unicorn/no-null
            this.#logger.debug(JSON.stringify(toolbox.argument, null, 2));
        }

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
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public constructor(cliName: string, options: CliOptions<T> = {}) {
        if (typeof cliName !== "string" || cliName.trim().length === 0) {
            throw new CerebroError("CLI name must be a non-empty string", "INVALID_INPUT", { cliName });
        }

        this.#cliName = cliName.trim();

        const argv = options.argv ?? getRuntimeArgv();
        const cwd = options.cwd ?? getRuntimeCwd();

        this.#options = { ...options, argv, cwd };

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

        const env = getEnv();

        env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_NORMAL);

        if (typeof this.#options.logger === "object") {
            const requiredMethods = ["debug", "error", "info", "log", "warn"] as const;
            const missingMethods: string[] = [];
            const logger = this.#options.logger as Record<string, unknown>;

            for (const method of requiredMethods) {
                if (typeof logger[method] !== "function") {
                    missingMethods.push(method);
                }
            }

            if (missingMethods.length > 0) {
                throw new CerebroError(`Logger object is missing required methods: ${missingMethods.join(", ")}`, "INVALID_INPUT", {
                    logger: this.#options.logger,
                    missingMethods,
                });
            }

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
        this.#commandSection = {};

        this.#commands = new Map<string, ICommand<OptionDefinition<unknown>, T>>();
        this.#commandPaths = new Map<string, string[]>();
        this.#commandsByPath = new Map<string, ICommand<OptionDefinition<unknown>, T>>();
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
        if (!this.#commandSection.header) {
            this.#commandSection.header = `${this.#cliName}${this.#packageVersion ? ` v${this.#packageVersion}` : ""}`;
        }

        return this.#commandSection;
    }

    /**
     * Sets the default command to run when no command is specified.
     *
     * By default, this is set to 'help'. The command must already be registered
     * with the CLI instance.
     * @param commandName The command name to use as the default
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
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public addCommand<OD extends OptionDefinition<unknown> = OptionDefinition<unknown>>(command: ICommand<OD, T>): this {
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

        if (command.commandPath) {
            validateStringArray(command.commandPath, "Command commandPath");
            command.commandPath.forEach((segment) => {
                validateCommandName(segment);
            });
        }

        const fullPath = getFullCommandPath(command.name, command.commandPath);
        const pathKey = getCommandPathKey(fullPath);

        if (this.#commandPaths.has(pathKey)) {
            throw new CerebroError(`Command with path "${pathKey}" already exists`, "DUPLICATE_COMMAND", {
                commandName: command.name,
                commandPath: command.commandPath,
            });
        }

        if (this.#commands.has(command.name) && !command.commandPath) {
            throw new CerebroError(`Command with name "${command.name}" already exists`, "DUPLICATE_COMMAND", { commandName: command.name });
        }

        if (command.options) {
            for (const option of command.options) {
                mapOptionTypeLabel<OD>(option);
            }
        }

        validateDuplicateOptions(command as unknown as ICommand<OptionDefinition<unknown>, Console>);
        addNegatableOptions(command as { name: string; options?: OptionDefinition<unknown>[] });
        processOptionNames(command as { options?: OptionDefinition<unknown>[] });

        if (command.options) {
            // eslint-disable-next-line no-param-reassign
            command.__conflictingOptions__ = command.options.filter((option) => option.conflicts !== undefined) as typeof command.__conflictingOptions__;
            // eslint-disable-next-line no-param-reassign
            command.__requiredOptions__ = command.options.filter((option) => option.required === true) as typeof command.__requiredOptions__;
        }

        this.#commands.set(command.name, command);
        this.#commandPaths.set(pathKey, fullPath);
        this.#commandsByPath.set(pathKey, command);

        this.#invalidateCommandCache();

        if (command.alias !== undefined) {
            const aliases = typeof command.alias === "string" ? [command.alias] : (command.alias as string[]);

            for (const alias of aliases) {
                const env = getEnv();

                if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
                    this.#logger.debug("adding alias", alias);
                }

                if (this.#commands.has(alias)) {
                    throw new CerebroError(`Command alias "${alias}" conflicts with existing command`, "DUPLICATE_COMMAND", {
                        alias,
                        commandName: command.name,
                    });
                }

                this.#commands.set(alias, command);
            }
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
    public addPlugin(plugin: Plugin<T>): this {
        this.getPluginManager().register(plugin);

        return this;
    }

    /**
     * Gets the plugin manager instance for advanced plugin management.
     * @returns The plugin manager instance
     */
    public getPluginManager(): PluginManager<T> {
        if (this.#pluginManager) {
            return this.#pluginManager;
        }

        this.#pluginManager = new PluginManager(this.#logger);
        this.#pluginManager.register({
            description: "Attaches the logger to the toolbox",
            execute: (toolbox) => {
                // eslint-disable-next-line no-param-reassign
                toolbox.logger = this.#logger;
            },
            name: "logger",
        });

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
    public getCommands(): Map<string, ICommand<OptionDefinition<unknown>, T>> {
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
     * @throws {Error} If command arguments are invalid or conflicting options are provided
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
            this.addCommand(new HelpCommand<T>(this.#commands));
        }

        const commandNames = this.#getCommandNames();
        const commandPathMap = this.#commandPaths;

        this.#ensureExceptionHandlers();

        const argv = this.#getArgv();

        let parsedCommandPath: string[] | undefined;
        let remainingArgv: string[] = [...argv];

        const execPath = getExecPath();
        const execArgv = getExecArgv();
        const runtimeArgv = getRuntimeArgv();

        this.#logger.debug(`process.execPath: ${execPath}`);
        this.#logger.debug(`process.execArgv: ${execArgv.join(" ")}`);
        this.#logger.debug(`process.argv: ${runtimeArgv.join(" ")}`);

        const nestedResult = parseNestedCommand(commandPathMap, [...argv]);

        if (nestedResult.commandPath) {
            parsedCommandPath = nestedResult.commandPath;
            remainingArgv = nestedResult.argv;
        } else {
            if (argv.length > 1 && argv[0] && argv[1] && !isOption(argv[0]) && !isOption(argv[1])) {
                const attemptedPath: string[] = [];
                let i = 0;

                while (i < argv.length) {
                    const argument = argv[i];

                    if (!argument || isOption(argument)) {
                        break;
                    }

                    attemptedPath.push(argument);
                    i += 1;
                }

                const attemptedPathKey = getCommandPathKey(attemptedPath);

                if (attemptedPath[0] && !commandNames.includes(attemptedPath[0])) {
                    const allCommandPaths = this.#getAllCommandPaths();
                    const alternatives = findAlternatives(attemptedPathKey, allCommandPaths);

                    throw new CommandNotFoundError(attemptedPathKey, alternatives);
                }
            }

            let parsedArguments: { argv: string[]; command: string | null | undefined };

            try {
                // eslint-disable-next-line unicorn/no-null
                parsedArguments = commandLineCommands([null, ...commandNames], [...argv]);
            } catch (error) {
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

        if (!parsedCommandPath) {
            if (this.#defaultCommand) {
                parsedCommandPath = [this.#defaultCommand];
            } else {
                const allCommandPaths = this.#getAllCommandPaths();

                throw new CommandNotFoundError("", allCommandPaths);
            }
        }

        const pathKey = getCommandPathKey(parsedCommandPath);
        const storedPath = this.#commandPaths.get(pathKey);

        let command: ICommand<OptionDefinition<unknown>, T> | undefined;

        if (storedPath) {
            command = this.#commandsByPath.get(pathKey);

            if (!command || getCommandPathKey(storedPath) !== pathKey) {
                const allCommandPaths = this.#getAllCommandPaths();
                const alternatives = findAlternatives(pathKey, allCommandPaths);

                throw new CommandNotFoundError(pathKey, alternatives);
            }
        } else {
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

            return shouldExitProcess ? exitProcess(1) : undefined;
        }

        const commandArguments = remainingArgv;

        const { commandArgs, toolbox } = this.#executeCommandInternal(command, commandArguments, otherExtraOptions, pathKey);

        const pluginManager = this.getPluginManager();

        try {
            if (!this.#pluginsInitialized && pluginManager.hasPlugins()) {
                await pluginManager.init({
                    cli: this as ICli<T>,
                    cwd: this.#cwd,
                    logger: this.#logger,
                });

                this.#pluginsInitialized = true;
            }

            await pluginManager.executeLifecycle("execute", toolbox as IToolbox<T>);

            await pluginManager.executeLifecycle("beforeCommand", toolbox as IToolbox<T>);

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
                result = await executeCommand(command, toolbox, commandArgs);
            }

            await pluginManager.executeLifecycle("afterCommand", toolbox as IToolbox<T>, result);

            return shouldExitProcess ? exitProcess(0) : undefined;
        } catch (error) {
            await pluginManager.executeErrorHandlers(error as Error, toolbox as IToolbox<T>);

            throw error;
        } finally {
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

        validateNonEmptyString(commandName, "Command name");

        const commandPath = commandName.split(" ").filter(Boolean);
        const pathKey = getCommandPathKey(commandPath);
        const storedPath = this.#commandPaths.get(pathKey);

        const command: ICommand<OptionDefinition<unknown>, T> | undefined = storedPath ? this.#commandsByPath.get(pathKey) : this.#commands.get(commandName);

        if (!command) {
            const allCommandPaths = this.#getAllCommandPaths();
            const alternatives = findAlternatives(pathKey || commandName, allCommandPaths);

            throw new CommandNotFoundError(commandName, alternatives);
        }

        if (typeof command.execute !== "function") {
            throw new CerebroError(`Command "${command.name}" has no function to execute`, "INVALID_COMMAND", { commandName: command.name });
        }

        const sanitizedArgv = sanitizeArguments(providedArgv);
        const commandArguments = [...sanitizedArgv];

        this.#logger.debug(`running command '${commandName}' programmatically with args: ${commandArguments.join(", ")}`);

        const { commandArgs, toolbox } = this.#executeCommandInternal(command, commandArguments, extraOptions, pathKey || commandName);

        const pluginManager = this.getPluginManager();

        try {
            if (!this.#pluginsInitialized && pluginManager.hasPlugins()) {
                await pluginManager.init({
                    cli: this as ICli<T>,
                    cwd: this.#cwd,
                    logger: this.#logger,
                });

                this.#pluginsInitialized = true;
            }

            await pluginManager.executeLifecycle("execute", toolbox as IToolbox<T>);

            await pluginManager.executeLifecycle("beforeCommand", toolbox as IToolbox<T>);

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
                result = await executeCommand(command, toolbox, commandArgs);
            }

            await pluginManager.executeLifecycle("afterCommand", toolbox as IToolbox<T>, result);

            return result;
        } catch (error) {
            await pluginManager.executeErrorHandlers(error as Error, toolbox as IToolbox<T>);

            throw error;
        }
    }
}
