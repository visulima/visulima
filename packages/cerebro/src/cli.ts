import { argv as process_argv, cwd as process_cwd, env, execArgv, execPath, exit } from "node:process";

import { boxen } from "@visulima/boxen";
import { dim, green, reset, yellow } from "@visulima/colorize";
import type { CommandLineOptions } from "@visulima/command-line-args";
// eslint-disable-next-line import/no-extraneous-dependencies
import { commandLineArgs } from "@visulima/command-line-args";
import type { ConstructorOptions, ExtendedRfc5424LogLevels, Pail, Processor } from "@visulima/pail";
import CallerProcessor from "@visulima/pail/processor/caller";
import MessageFormatterProcessor from "@visulima/pail/processor/message-formatter";
import { createPail } from "@visulima/pail/server";
// eslint-disable-next-line import/no-extraneous-dependencies
import camelCase from "camelcase";

import type {
    Cli as ICli,
    Command as ICommand,
    CommandSection as ICommandSection,
    Extension as IExtension,
    Options as IOptions,
    Toolbox as IToolbox,
} from "./@types";
import type { CliRunOptions } from "./@types/cli";
import type { OptionDefinition, PossibleOptionDefinition } from "./@types/command";
import HelpCommand from "./command/help";
import VersionCommand from "./command/version";
import { POSITIONALS_KEY, VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "./constants";
import defaultOptions from "./default-options";
import EmptyToolbox from "./empty-toolbox";
import type { UpdateNotifierOptions } from "./update-notifier/has-new-version";
import checkNodeVersion from "./util/check-node-version";
import getBooleanValues from "./util/command-line-args/get-boolean-values";
import mapOptionTypeLabel from "./util/command-line-args/map-option-type-label";
import removeBooleanValues from "./util/command-line-args/remove-boolean-values";
import commandLineCommands from "./util/command-line-commands";
import findAlternatives from "./util/levenstein";
import listMissingArguments from "./util/list-missing-arguments";
import mergeArguments from "./util/merge-arguments";
import parseRawCommand from "./util/parse-raw-command";
import registerExceptionHandler from "./util/register-exception-handler";

/** Detect if `CI` environment variable is set */
const isCI = "CI" in env && ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);

const lowerFirstChar = (string_: string): string => string_.charAt(0).toLowerCase() + string_.slice(1);

export type CliOptions = {
    argv?: string[];
    cwd?: string;
    logger?: ConstructorOptions<string, string>;
    packageName?: string;
    packageVersion?: string;
};

export class Cli implements ICli {
    private readonly logger: Pail;

    private readonly argv: string[];

    private readonly cwd: string;

    private readonly cliName: string;

    private readonly packageVersion: string | undefined;

    private readonly packageName: string | undefined;

    private readonly extensions: IExtension[] = [];

    private readonly commands: Map<string, ICommand>;

    private defaultCommand: string;

    private updateNotifierOptions: UpdateNotifierOptions | undefined;

    private commandSection: ICommandSection;

    /**
     * @param cliName The cli cliName.
     * @param options The options for the CLI.
     * - argv           This should be in the base case process.argv
     * - cwd            The path of main folder.
     * - logger         The logger options.
     * - packageName    The packageJson name.
     * - packageVersion The packageJson version.
     */
    public constructor(cliName: string, options: CliOptions = {}) {
        const { argv, cwd, packageName, packageVersion } = {
            argv: process_argv,
            cwd: process_cwd(),
            ...options,
        };

        this.argv = parseRawCommand(argv);

        // If the "--quiet"/"-q" flag is ever present, set our global logging
        // to quiet mode. Also set the level on the logger we've already created.
        if (this.argv.includes("--quiet") || this.argv.includes("-q")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_QUIET);

            // If the "--verbose"/"-v" flag is ever present, set our global logging
            // to verbose mode. Also set the level on the logger we've already created.
        } else if (this.argv.includes("--verbose") || this.argv.includes("-v")) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_VERBOSE);
        } else if (this.argv.includes("--debug") || this.argv.includes("-vvv") || "DEBUG" in env) {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_DEBUG);
        } else {
            env.CEREBRO_OUTPUT_LEVEL = String(VERBOSITY_NORMAL);
        }

        const cerebroLevelToPailLevel: Record<string, ExtendedRfc5424LogLevels> = {
            32: "informational",
            64: "trace",
            128: "debug",
        };

        const processors: Processor<string>[] = [new MessageFormatterProcessor()];

        if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
            processors.push(new CallerProcessor());
        }

        this.logger = createPail({
            logLevel: env.CEREBRO_OUTPUT_LEVEL
                ? cerebroLevelToPailLevel[env.CEREBRO_OUTPUT_LEVEL as keyof typeof cerebroLevelToPailLevel] ?? "informational"
                : "informational",
            processors,
            ...options.logger,
        });

        if (env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_QUIET)) {
            this.logger.disable();
        }

        checkNodeVersion();
        registerExceptionHandler(this.logger);

        this.cliName = cliName;
        this.packageVersion = packageVersion;
        this.packageName = packageName;
        this.cwd = cwd;
        this.defaultCommand = "help";
        this.commandSection = {
            header: `${this.cliName}${this.packageVersion ? ` v${this.packageVersion}` : ""}`,
        };

        this.commands = new Map<string, ICommand>();

        this.addCoreExtensions();

        this.addCommand(VersionCommand);
        this.addCommand(new HelpCommand(this.commands));
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
     * Adds an extension so it is available when commands execute. They usually live
     * the given name on the toolbox object passed to commands, but are able
     * to manipulate the toolbox object however they want.
     */
    public addExtension(extension: IExtension): this {
        this.extensions.push(extension);

        return this;
    }

    /**
     * Enable the update notifier functionality with the given options.
     * @param options The options for enabling the update notifier.
     * options.alwaysRun - Determines whether the update check should always run. Defaults to false.
     * options.distributionTag - The distribution tag to use for checking updates. Defaults to "latest".
     * options.updateCheckInterval - The interval in milliseconds between each update check. Defaults to 24 hours.
     * @example
     * enableUpdateNotifier({
     *   alwaysRun: true,
     *   debug: false,
     *   distributionTag: "stable",
     *   pkg: {
     *     name: "my-package",
     *     version: "1.0.0"
     *   },
     *   updateCheckInterval: 1000 * 60 * 60
     * });
     */
    public enableUpdateNotifier(options: Partial<Omit<UpdateNotifierOptions, "debug | pkg">> = {}): this {
        if (!this.packageName || !this.packageVersion) {
            throw new Error("Cannot enable update notifier without package name and version.");
        }

        const configKeys = Object.keys(options);

        if (configKeys.length > 0 && !configKeys.includes("alwaysRun") && !configKeys.includes("distTag") && !configKeys.includes("updateCheckInterval")) {
            throw new Error("Invalid update notifier options, please check the documentation.");
        }

        this.updateNotifierOptions = {
            alwaysRun: false,
            debug: env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG),
            distTag: "latest",
            pkg: {
                name: this.packageName,
                version: this.packageVersion,
            },
            updateCheckInterval: 1000 * 60 * 60 * 24,
            ...options,
        };

        return this;
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

        // allow extensions to attach themselves to the toolbox
        await this.registerExtensions(toolbox);

        await this.updateNotifier(toolbox);

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

        await this.prepareToolboxResult(commandArgs, toolbox, command);

        return shouldExitProcess ? exit(0) : undefined;
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

    /**
     * Adds the core extensions. These provide the basic features
     * available in cerebro.
     */
    private addCoreExtensions() {
        this.addExtension({
            execute: (toolbox: IToolbox) => {
                // eslint-disable-next-line no-param-reassign
                toolbox.logger = this.logger;
            },
            name: "logger",
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async prepareToolboxResult<OD extends OptionDefinition<any>>(commandArgs: CommandLineOptions, toolbox: IToolbox, command: ICommand<OD>) {
        // Help is a special argument for displaying help for the given command.
        // If found, run the help command instead, with the given command name as
        // an option.
        if (commandArgs.global?.help) {
            this.logger.debug("'--help' option found, running 'help' for given command...");
            const helpCommand = this.commands.get("help");

            if (!helpCommand) {
                throw new Error("Help command not found.");
            }

            await helpCommand.execute(toolbox);

            return;
        }

        if (commandArgs.global?.version || commandArgs.global?.V) {
            this.logger.debug("'--version' option found, running 'version' for given command...");
            const helpCommand = this.commands.get("version");

            if (!helpCommand) {
                throw new Error("Version command not found.");
            }

            await helpCommand.execute(toolbox);

            return;
        }

        await command.execute(toolbox);
    }

    private async updateNotifier({ logger }: IToolbox) {
        if (
            this.updateNotifierOptions?.alwaysRun
            || (!(env.NO_UPDATE_NOTIFIER || env.NODE_ENV === "test" || this.argv.includes("--no-update-notifier") || isCI) && this.updateNotifierOptions)
        ) {
            // @TODO add a stream logger
            logger.raw("Checking for updates...");

            const hasNewVersion = await import("./update-notifier/has-new-version").then((m) => m.default);

            const updateAvailable = await hasNewVersion(this.updateNotifierOptions);

            if (updateAvailable) {
                const template = `Update available ${dim(`${this.packageVersion}`)}${reset(" → ")}${green(updateAvailable)}`;

                this.logger.error(
                    boxen(template, {
                        borderColor: (border: string) => yellow(border),
                        borderStyle: "round",
                        margin: 1,
                        padding: 1,
                        textAlignment: "center",
                    }),
                );
            }
        }
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

    private async registerExtensions(toolbox: IToolbox): Promise<void> {
        const callback = async (extension: IExtension) => {
            if (typeof extension.execute !== "function") {
                this.logger.warn(`Skipped ${extension.name} because execute is not a function.`);

                return undefined;
            }

            await extension.execute(toolbox as IToolbox);

            return undefined;
        };

        for (const extension of this.extensions) {
            // eslint-disable-next-line no-await-in-loop
            await callback(extension);
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
