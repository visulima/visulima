import { argv as process_argv, cwd as process_cwd, env, execArgv, execPath, exit } from "node:process";

import type { CommandLineOptions } from "@visulima/command-line-args";
// eslint-disable-next-line import/no-extraneous-dependencies
import { commandLineArgs } from "@visulima/command-line-args";

import type { Cli as ICli, CliRunOptions, CommandSection as ICommandSection } from "./@types/cli";
import type { Command as ICommand, OptionDefinition, PossibleOptionDefinition } from "./@types/command";
import type { Options as IOptions } from "./@types/options";
import type { Plugin } from "./@types/plugin";
import type { Toolbox as IToolbox } from "./@types/toolbox";
import { POSITIONALS_KEY, VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "./constants";
import defaultOptions from "./default-options";
import EmptyToolbox from "./empty-toolbox";
import PluginManager from "./plugin-manager";
import getBooleanValues from "./util/command-line-args/get-boolean-values";
import mapOptionTypeLabel from "./util/command-line-args/map-option-type-label";
import removeBooleanValues from "./util/command-line-args/remove-boolean-values";
import commandLineCommands from "./util/command-line-commands";
import findAlternatives from "./util/find-alternatives";
import listMissingArguments from "./util/list-missing-arguments";
import mergeArguments from "./util/merge-arguments";
import parseRawCommand from "./util/parse-raw-command";
import registerExceptionHandler from "./util/register-exception-handler";

const lowerFirstChar = (string_: string): string => string_.charAt(0).toLowerCase() + string_.slice(1);

/**
 * Lightweight camelCase implementation for option names
 * Converts kebab-case and snake_case to camelCase
 */
const camelCase = (string_: string): string => {
    // Fast path for strings without separators
    if (!string_.includes("-") && !string_.includes("_")) {
        return string_;
    }

    return string_.replaceAll(/[-_](.)/g, (_, character) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase());
};

export type CliOptions<T extends Console = Console> = {
    argv?: string[];
    cwd?: string;
    logger?: T;
    packageName?: string;
    packageVersion?: string;
};

export class Cli<T extends Console = Console> implements ICli {
    private logger: T;

    private readonly options: CliOptions<T>;

    private readonly argv: string[];

    private readonly cwd: string;

    private readonly cliName: string;

    private readonly packageVersion: string | undefined;

    private readonly packageName: string | undefined;

    private readonly pluginManager: PluginManager;

    private readonly commands: Map<string, ICommand>;

    private defaultCommand: string;

    private commandSection: ICommandSection;

    private pluginsInitialized = false;

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
        this.options = {
            argv: process_argv,
            cwd: process_cwd(),
            ...options,
        };

        this.argv = parseRawCommand(this.options.argv as string[]);

        // Set verbosity level from command line flags
        if (this.argv.includes("--quiet") || this.argv.includes("-q")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_QUIET);
        } else if (this.argv.includes("--verbose") || this.argv.includes("-v")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_VERBOSE);
        } else if (this.argv.includes("--debug") || this.argv.includes("-vvv") || "DEBUG" in env) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_DEBUG);
        } else {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_NORMAL);
        }

        if (typeof this.options.logger === "object") {
            this.logger = this.options.logger;
        } else {
            this.logger = {
                ...console,
                debug: (...args) => {
                    if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
                        // eslint-disable-next-line no-console
                        console.debug(...args);
                    }
                },
            } as T;
        }

        this.cliName = cliName;
        this.packageVersion = this.options.packageVersion;
        this.packageName = this.options.packageName;
        this.cwd = this.options.cwd as string;
        this.defaultCommand = "help";
        this.commandSection = {
            header: `${this.cliName}${this.packageVersion ? ` v${this.packageVersion}` : ""}`,
        };

        this.commands = new Map<string, ICommand>();

        this.pluginManager = new PluginManager(this.logger);

        this.pluginManager.register({
            description: "Attaches the logger to the toolbox",
            execute: (toolbox) => {
                // eslint-disable-next-line no-param-reassign
                toolbox.logger = this.logger;
            },
            name: "logger",
        });

        registerExceptionHandler(this.logger);
    }

    public setCommandSection(commandSection: ICommandSection): this {
        this.commandSection = commandSection;

        return this;
    }

    public getCommandSection(): ICommandSection {
        return this.commandSection;
    }

    /**
     * Set a default command, to display a different command if cli is call without command.
     */
    public setDefaultCommand(commandName: string): this {
        this.defaultCommand = commandName;

        return this;
    }

    /**
     * Add an arbitrary command to the CLI.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public addCommand<OD extends OptionDefinition<any> = any>(command: ICommand<OD>): this {
        // add the command to the runtime (if it isn't already there)
        if (this.commands.has(command.name)) {
            throw new Error(`Ignored command with name "${command.name}", it was found in the command list.`);
        } else {
            command.options?.map((option) => mapOptionTypeLabel<OD>(option));

            this.validateDoubleOptions<OD>(command);
            this.addNegatableOption<OD>(command);

            command.options?.forEach((option) => {
                // eslint-disable-next-line no-underscore-dangle,no-param-reassign
                option.__camelCaseName__ = camelCase(option.name);
            });

            this.commands.set(command.name, command);

            if (command.alias !== undefined) {
                let aliases: string[] = command.alias as string[];

                if (typeof command.alias === "string") {
                    aliases = [command.alias];
                }

                aliases.forEach((alias) => {
                    this.logger.debug("adding alias", alias);

                    if (this.commands.has(alias)) {
                        throw new Error(`Ignoring command alias "${alias}, command with the same name was found."`);
                    } else {
                        this.commands.set(alias, command);
                    }
                });
            }
        }

        return this;
    }

    /**
     * Add a plugin to extend the CLI functionality
     * @param plugin The plugin to add
     * @returns self
     */
    public addPlugin(plugin: Plugin): this {
        this.pluginManager.register(plugin);

        return this;
    }

    /**
     * Get the plugin manager instance
     * @returns The plugin manager
     */
    public getPluginManager(): PluginManager {
        return this.pluginManager;
    }

    public getCliName(): string {
        return this.cliName;
    }

    public getPackageVersion(): string | undefined {
        return this.packageVersion;
    }

    public getPackageName(): string | undefined {
        return this.packageName;
    }

    public getCommands(): Map<string, ICommand> {
        return this.commands;
    }

    public getCwd(): string {
        return this.cwd;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async run(extraOptions: CliRunOptions = {}): Promise<void> {
        const { shouldExitProcess = true, ...otherExtraOptions } = extraOptions;

        // Lazy load help and version commands to improve init time
        const [{ default: VersionCommand }, { default: HelpCommand }] = await Promise.all([
            import("./command/version-command"),
            import("./command/help-command"),
        ]);

        this.addCommand(VersionCommand);
        this.addCommand(new HelpCommand(this.commands));

        const commandNames = [...this.commands.keys()];

        let parsedArguments: { argv: string[]; command: string | null | undefined };

        this.logger.debug(`process.execPath: ${execPath}`);
        this.logger.debug(`process.execArgv: ${execArgv.join(" ")}`);
        this.logger.debug(`process.argv: ${process_argv.join(" ")}`);

        try {
            // eslint-disable-next-line unicorn/no-null
            parsedArguments = commandLineCommands([null, ...commandNames], this.argv);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // CLI needs a valid command name to do anything. If the given
            // command is invalid, run the generalized help command with default
            // config. This should print the general usage information.
            if (error.name === "INVALID_COMMAND" && error.command) {
                let alternatives = "";

                const foundAlternatives = findAlternatives(error.command, [...this.commands.keys()]);

                if (foundAlternatives.length > 0) {
                    alternatives = ` Did you mean: \r\n    - ${foundAlternatives.join("    \r\n- ")}`;
                }

                this.logger.error(`"${error.command}" is not an available command.${alternatives}`);
            } else {
                this.logger.error(error as Error);
            }

            return shouldExitProcess ? exit(1) : undefined;
        }

        const commandName = parsedArguments.command ?? this.defaultCommand;
        const command = this.commands.get(commandName) as ICommand;

        if (typeof command.execute !== "function") {
            this.logger.error(`Command "${command.name}" has no function to execute.`);

            return shouldExitProcess ? exit(1) : undefined;
        }

        const commandArguments = parsedArguments.argv;

        this.logger.debug(`command '${commandName}' found, parsing command args: ${commandArguments.join(", ")}`);

        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let arguments_ = mergeArguments([...command.options ?? [], ...defaultOptions]);

        arguments_.forEach((argument) => {
            if (argument.multiple && argument.lazyMultiple) {
                throw new Error(`Argument "${argument.name}" cannot have both multiple and lazyMultiple options, please choose one.`);
            }
        });

        if (command.argument) {
            this.logger.debug("command has positional argument, parsing them...");

            arguments_ = [
                {
                    defaultOption: true,

                    description: command.argument?.description,
                    group: "positionals",
                    multiple: true,
                    name: POSITIONALS_KEY,

                    type: command.argument?.type,

                    typeLabel: command.argument?.typeLabel,
                },
                ...arguments_,
            ];
        }

        const parsedArgs = commandLineArgs(arguments_, {
            argv: removeBooleanValues(commandArguments, command.options ?? []),
            camelCase: true,
            partial: true,
            stopAtFirstUnknown: true,
        });

        const booleanValues = getBooleanValues(commandArguments, command.options ?? []);

        // eslint-disable-next-line no-underscore-dangle
        const commandArgs = { ...parsedArgs, _all: { ...parsedArgs._all, ...booleanValues } } as typeof parsedArgs;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.validateCommandOptions<any>(arguments_, commandArgs, command);

        // prepare the execute toolbox
        const toolbox = new EmptyToolbox(command.name, command) as unknown as IToolbox;

        // attach the runtime
        toolbox.runtime = this as ICli;

        // initialize plugins on first run
        if (!this.pluginsInitialized) {
            await this.pluginManager.init({
                cli: this as ICli,
                cwd: this.cwd,
                logger: this.logger,
            });

            this.pluginsInitialized = true;
        }

        // execute plugins that need to modify the toolbox (like attaching logger, custom properties, etc.)
        await this.pluginManager.executeLifecycle("execute", toolbox);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { _all, positionals } = commandArgs;

        if (_all[POSITIONALS_KEY]) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete _all[POSITIONALS_KEY];
        }

        toolbox.argument = positionals?.[POSITIONALS_KEY] ?? [];
        toolbox.argv = this.argv;
        toolbox.options = { ..._all, ...otherExtraOptions };

        this.mapNegatableOptions(toolbox, command);
        this.mapImpliesOptions(toolbox, command);

        this.validateCommandArgsForConflicts(arguments_, toolbox.options, command);

        this.logger.debug("command options parsed from options:");
        // eslint-disable-next-line unicorn/no-null
        this.logger.debug(JSON.stringify(toolbox.options, null, 2));
        this.logger.debug("command argument parsed from argument:");
        // eslint-disable-next-line unicorn/no-null
        this.logger.debug(JSON.stringify(toolbox.argument, null, 2));

        try {
            // Execute beforeCommand hooks
            await this.pluginManager.executeLifecycle("beforeCommand", toolbox);

            // Execute the command
            const result = await this.prepareToolboxResult(commandArgs, toolbox, command);

            // Execute afterCommand hooks
            await this.pluginManager.executeLifecycle("afterCommand", toolbox, result);

            return shouldExitProcess ? exit(0) : undefined;
        } catch (error) {
            // Execute error handlers
            await this.pluginManager.executeErrorHandlers(error as Error, toolbox);

            // Re-throw the error
            throw error;
        }
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-explicit-any
    private validateDoubleOptions<OD extends OptionDefinition<any> = any>(command: ICommand<OD>): void {
        if (Array.isArray(command.options)) {
            // eslint-disable-next-line unicorn/no-array-reduce
            const groupedDuplicatedOption = command.options.reduce<Record<string, OptionDefinition<OD>[]>>((accumulator, object) => {
                const key = `${object.name}-${object.alias}`;

                if (!accumulator[key]) {
                    accumulator[key] = [];
                }

                (accumulator[key] as OptionDefinition<OD>[]).push(object as OptionDefinition<OD>);

                return accumulator;
            }, {});
            const duplicatedOptions = Object.values(groupedDuplicatedOption).filter((object) => object.length > 1);

            let errorMessages = "";

            duplicatedOptions.forEach((options) => {
                const matchingOption = options[0] as OptionDefinition<OD>;
                const duplicate = options[1] as OptionDefinition<OD>;

                let flag = "alias";

                if (matchingOption.name === duplicate.name) {
                    flag = "name";

                    if (matchingOption.alias === duplicate.alias) {
                        flag += " and alias";
                    }
                }

                errorMessages += `Cannot add option ${flag} "${JSON.stringify(duplicate)}" to command "${
                    command.name
                }" due to conflicting option ${JSON.stringify(matchingOption)}\n`;
            });

            if (errorMessages.length > 0) {
                throw new Error(errorMessages);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async prepareToolboxResult<OD extends OptionDefinition<any>>(
        commandArgs: CommandLineOptions,
        toolbox: IToolbox,
        command: ICommand<OD>,
    ): Promise<unknown> {
        // Help is a special argument for displaying help for the given command.
        // If found, run the help command instead, with the given command name as
        // an option.
        if (commandArgs.global?.help) {
            this.logger.debug("'--help' option found, running 'help' for given command...");
            const helpCommand = this.commands.get("help");

            if (!helpCommand) {
                throw new Error("Help command not found.");
            }

            return await helpCommand.execute(toolbox);
        }

        if (commandArgs.global?.version || commandArgs.global?.V) {
            this.logger.debug("'--version' option found, running 'version' for given command...");
            const versionCommand = this.commands.get("version");

            if (!versionCommand) {
                throw new Error("Version command not found.");
            }

            return await versionCommand.execute(toolbox);
        }

        return await command.execute(toolbox);
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-explicit-any
    private validateCommandOptions<OD extends OptionDefinition<any>>(
        arguments_: PossibleOptionDefinition<OD>[],
        commandArguments: CommandLineOptions,
        command: ICommand<OD>,
    ): void {
        const missingOptions = listMissingArguments(arguments_, commandArguments);

        if (missingOptions.length > 0) {
            throw new Error(
                `You called the command "${command.name}" without the required options: ${missingOptions.map((argument) => argument.name).join(", ")}`,
            );
        }

        // eslint-disable-next-line no-underscore-dangle
        if (commandArguments._unknown && commandArguments._unknown.length > 0) {
            const errors: string[] = [];

            // eslint-disable-next-line no-underscore-dangle
            commandArguments._unknown.forEach((unknownOption) => {
                const isOption = unknownOption.startsWith("--");

                let error = `Found unknown ${isOption ? "option" : "argument"} "${unknownOption}"`;

                if (isOption) {
                    const foundAlternatives = findAlternatives(unknownOption.replace("--", ""), [
                        ...(command.options ?? []).map((option) => option.name),
                        ...defaultOptions.map((option) => option.name),
                    ]);

                    if (foundAlternatives.length > 0) {
                        const [first, ...rest] = foundAlternatives.map((alternative) => `--${alternative}`);

                        error += rest.length > 0 ? `, did you mean ${first} or ${rest.join(", ")}?` : `, did you mean ${first}?`;
                    }
                }

                errors.push(error);
            });

            if (errors.length > 0) {
                throw new Error(errors.join("\n"));
            }
        }
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-explicit-any
    private validateCommandArgsForConflicts<OD extends OptionDefinition<any>>(
        arguments_: PossibleOptionDefinition<OD>[],
        commandArguments: IToolbox["options"],
        command: ICommand<OD>,
    ): void {
        const conflicts = arguments_.filter((argument) => argument.conflicts !== undefined);

        if (conflicts.length > 0) {
            const conflict = conflicts.find((argument) => {
                if (Array.isArray(argument.conflicts)) {
                    return argument.conflicts.some((c) => commandArguments[c] !== undefined) && commandArguments[argument.name] !== undefined;
                }

                return commandArguments[argument.conflicts as string] !== undefined && commandArguments[argument.name] !== undefined;
            });

            if (conflict) {
                throw new Error(
                    `You called the command "${command.name}" with conflicting options: ${conflict.name} and ${
                        typeof conflict.conflicts === "string" ? conflict.conflicts : conflict.conflicts?.join(", ")
                    }`,
                );
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private addNegatableOption<OD extends OptionDefinition<any>>(command: ICommand<OD>): void {
        if (Array.isArray(command.options)) {
            command.options.forEach((option) => {
                if (option.name.startsWith("no-") && !(command.options as OD[]).some((o) => o.name === option.name.replace("no-", ""))) {
                    if (option.type !== Boolean) {
                        this.logger.debug(`Cannot add negated option "${option.name}" to command "${command.name}" because it is not a boolean.`);

                        return;
                    }

                    const negatedOption = {
                        ...option,
                        defaultValue: option.defaultValue === undefined ? true : !option.defaultValue,
                        name: `${option.name.replace("no-", "")}`,
                    } as OD;

                    (command.options as OD[]).push(negatedOption);
                }
            });
        }
    }

    // combining negatable options with their non-negated counterparts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapNegatableOptions<OD extends OptionDefinition<any>>(toolbox: IToolbox, command: ICommand<OD>): void {
        Object.entries(toolbox.options as IToolbox["options"]).forEach(([key, value]) => {
            if (/^no\w+/.test(key)) {
                const nonNegatedKey: string = lowerFirstChar(key.replace("no", ""));

                this.logger.debug(`mapping negated option "${key}" to "${nonNegatedKey}"`);

                // eslint-disable-next-line no-param-reassign
                (toolbox.options as IOptions["options"])[nonNegatedKey] = !value;

                command.options?.forEach((option) => {
                    if (option.name === nonNegatedKey) {
                        // eslint-disable-next-line no-underscore-dangle,no-param-reassign
                        option.__negated__ = true;
                    }
                });
            }
        });
    }

    // Apply any implied option values, if option is undefined or default value.
    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-explicit-any
    private mapImpliesOptions<OD extends OptionDefinition<any>>(toolbox: IToolbox, command: ICommand<OD>): void {
        Object.keys(toolbox.options as IToolbox["options"]).forEach((optionKey) => {
            const option = command.options?.find(
                // eslint-disable-next-line no-underscore-dangle
                (o) => o.__camelCaseName__ === optionKey && o.__negated__ === undefined && o.implies !== undefined,
            );

            if (option?.implies) {
                const implies = option.implies as Record<string, unknown>;

                Object.entries(implies).forEach(([key, value]) => {
                    if (toolbox.options[key] === undefined) {
                        // eslint-disable-next-line no-param-reassign
                        toolbox.options[key] = value;
                    } else {
                        const impliedOption = command.options?.find((cOption) => cOption.name === key);

                        if (impliedOption?.defaultValue === undefined || toolbox.options[key] === impliedOption.defaultValue) {
                            // eslint-disable-next-line no-param-reassign
                            toolbox.options[key] = value;
                        }
                    }
                });
            }
        });
    }
}
