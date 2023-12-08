import boxen from "boxen";
import chalk from "chalk";
import type { CommandLineOptions } from "command-line-args";
import commandLineArgs from "command-line-args";
import { env } from "node:process";

import type {
    Cli as ICli,
    Command as ICommand,
    CommandSection as ICommandSection,
    Extension as IExtension,
    Logger as ILogger,
    Options as IOptions,
    Toolbox as IToolbox,
} from "./@types";
import type { OptionDefinition } from "./@types/command";
import HelpCommand from "./command/help";
import VersionCommand from "./command/version";
import { POSITIONALS_KEY, VERBOSITY_DEBUG, VERBOSITY_NORMAL, VERBOSITY_QUIET, VERBOSITY_VERBOSE, VERBOSITY_VERY_VERBOSE } from "./constants";
import defaultOptions from "./default-options";
import EmptyToolbox from "./empty-toolbox";
import logger from "./toolbox/logger-tools";
import type { UpdateNotifierOptions } from "./update-notifier/has-new-version";
import checkNodeVersion from "./util/check-node-version";
import commandLineCommands from "./util/command-line-commands";
import findAlternatives from "./util/levenstein";
import listMissingArguments from "./util/list-missing-arguments";
import mergeArguments from "./util/merge-arguments";
import parseRawCommand from "./util/parse-raw-command";
import registerExceptionHandler from "./util/register-exception-handler";

/** Detect if `CI` environment variable is set */
const isCI = env?.["CI"] !== "false";

/** Detect if `NODE_ENV` environment variable is `test` */
const isTest = env?.["NODE_ENV"] === "test" || env?.["TEST"] !== "false";

class Cli implements ICli {
    private readonly logger: ILogger;

    private readonly argv: string[];

    private readonly cwd: string;

    private readonly cliName: string;

    private readonly packageVersion: string | undefined;

    private readonly packageName: string | undefined;

    private readonly extensions: IExtension[] = [];

    private readonly commands: Map<string, ICommand>;

    private defaultCommand: string;

    private updateNotifierOptions: UpdateNotifierOptions | undefined;

    // If true, options with hypenated names (e.g. move-to) will be returned in camel-case (e.g. moveTo).
    private transformToCamelCase = true;

    private commandSection: ICommandSection;

    /**
     * @param cliName The cli cliName.
     * @param options The options for the CLI.
     *        - argv           This should be in the base case process.argv
     *        - cwd            The path of main folder.
     *        - packageName    The packageJson name.
     *        - packageVersion The packageJson version.
     */
    public constructor(
        cliName: string,
        options: {
            argv?: string[];
            cwd?: string;
            packageName?: string;
            packageVersion?: string;
        } = {},
    ) {
        this.logger = logger;

        checkNodeVersion();
        registerExceptionHandler(this.logger);

        env["CEREBRO_OUTPUT_LEVEL"] = String(VERBOSITY_NORMAL);

        const { argv, cwd, packageName, packageVersion } = {
            argv: process.argv,
            cwd: process.cwd(),
            ...options,
        };

        this.cliName = cliName;
        this.packageVersion = packageVersion;
        this.packageName = packageName;
        this.argv = argv;
        this.cwd = cwd;
        this.defaultCommand = "help";
        this.commandSection = {
            header: `${this.cliName}${this.packageVersion ? ` v${this.packageVersion}` : ""}`,
        };

        // If the "--quiet"/"-q" flag is ever present, set our global logging
        // to quiet mode. Also set the level on the logger we've already created.
        if (this.argv.includes("--quiet") || this.argv.includes("-q")) {
            env["CEREBRO_OUTPUT_LEVEL"] = String(VERBOSITY_QUIET);
        }

        // If the "--verbose"/"-v" flag is ever present, set our global logging
        // to verbose mode. Also set the level on the logger we've already created.
        if (this.argv.includes("--verbose") || this.argv.includes("-v")) {
            env["CEREBRO_OUTPUT_LEVEL"] = String(VERBOSITY_VERBOSE);
        } else if (this.argv.includes("--very-verbose") || this.argv.includes("-vv")) {
            env["CEREBRO_OUTPUT_LEVEL"] = String(VERBOSITY_VERY_VERBOSE);
        } else if (this.argv.includes("--debug") || this.argv.includes("-vvv")) {
            env["CEREBRO_OUTPUT_LEVEL"] = String(VERBOSITY_DEBUG);
        }

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
     * Disable the transformation of the options to camel case.
     */
    public disableCamelCase(): this {
        this.transformToCamelCase = false;

        return this;
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
    public addCommand(command: ICommand): this {
        // add the command to the runtime (if it isn't already there)
        if (this.commands.has(command.name)) {
            throw new Error(`Ignored command with name "${command.name}, it was found in the command list."`);
        } else {
            if (Array.isArray(command.options)) {
                const groupedDuplicatedOption = command.options.reduce<{ [key: string]: OptionDefinition<any>[] }>((acc, obj) => {
                    const key = `${obj.name}-${obj.alias}`;

                    if (!acc[key]) {
                        acc[key] = [];
                    }

                    (acc[key] as OptionDefinition<any>[]).push(obj);

                    return acc;
                }, {});
                const duplicatedOptions = Object.values(groupedDuplicatedOption).filter((obj) => obj.length > 1);

                let errorMessages = "";

                duplicatedOptions.forEach((options) => {
                    const matchingOption = options[0] as OptionDefinition<any>;
                    const duplicate = options[1] as OptionDefinition<any>;

                    let flag = "alias";

                    if (matchingOption.name === duplicate.name) {
                        flag = "name";
                    } else if (matchingOption.name === duplicate.name && matchingOption.alias === duplicate.alias) {
                        flag = "name and alias";
                    }

                    errorMessages += `Cannot add option ${flag} "${JSON.stringify(duplicate)}" to command "${
                        command.name
                    }" due to conflicting option ${JSON.stringify(matchingOption)}\n`;
                });

                if (errorMessages.length > 0) {
                    throw new Error(errorMessages);
                }
            }

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
     *
     * @param options - The options for enabling the update notifier.
     *          options.alwaysRun - Determines whether the update check should always run. Defaults to false.
     *          options.distributionTag - The distribution tag to use for checking updates. Defaults to "latest".
     *          options.updateCheckInterval - The interval in milliseconds between each update check. Defaults to 24 hours.
     *
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
            debug: env["CEREBRO_OUTPUT_LEVEL"] === String(VERBOSITY_DEBUG),
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
    public async run(extraOptions: IOptions = {}): Promise<void> {
        const commandNames = [...this.commands.keys()];

        let parsedArguments: { argv: string[]; command: string | null | undefined };

        this.logger.debug(`process.execPath: ${process.execPath}`);
        this.logger.debug(`process.execArgv: ${process.execArgv.join(" ")}`);
        this.logger.debug(`process.argv: ${process.argv.join(" ")}`);

        try {
            parsedArguments = commandLineCommands([null, ...commandNames], parseRawCommand(this.argv));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // CLI needs a valid command name to do anything. If the given
            // command is invalid, run the generalized help command with default
            // config. This should print the general usage information.
            if (error.name === "INVALID_COMMAND" && error.command) {
                let alternatives = "";

                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const foundAlternatives = findAlternatives(error.command, [...this.commands.keys()]);

                if (foundAlternatives.length > 0) {
                    alternatives = ` Did you mean: \r\n    - ${foundAlternatives.join("    \r\n- ")}`;
                }

                this.logger.error(`\r\n"${error.command}" is not an available command.${alternatives}`);
            } else {
                this.logger.error(error as object);
            }

            // eslint-disable-next-line unicorn/no-process-exit
            return isTest ? undefined : process.exit(1);
        }

        const commandName = parsedArguments.command ?? this.defaultCommand;
        const command = this.commands.get(commandName) as ICommand;

        if (typeof command.execute !== "function") {
            this.logger.error(`Command "${command.name}" has no function to execute.`);

            // eslint-disable-next-line unicorn/no-process-exit
            return isTest ? undefined : process.exit(1);
        }

        const commandArguments = parsedArguments.argv;

        this.logger.debug(`command '${commandName}' found, parsing command args: ${commandArguments.join(", ")}`);

        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let arguments_ = mergeArguments([...(command.options ?? []), ...defaultOptions]);

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
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    description: command.argument?.description,
                    group: "positionals",
                    multiple: true,
                    name: POSITIONALS_KEY,
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    type: command.argument?.type,
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    typeLabel: command.argument?.typeLabel,
                },
                ...arguments_,
            ];
        }

        // eslint-disable-next-line unicorn/prevent-abbreviations
        const commandArgs = commandLineArgs(arguments_, {
            argv: commandArguments,
            camelCase: this.transformToCamelCase,
            partial: true,
            stopAtFirstUnknown: true,
        });

        this.validateCommandOptions(arguments_, commandArgs, command);

        // prepare the execute toolbox
        const toolbox = new EmptyToolbox(command.name, command);

        // attach the runtime
        toolbox.runtime = this as ICli;

        // allow extensions to attach themselves to the toolbox
        const callback = async (extension: IExtension) => {
            if (typeof extension.execute !== "function") {
                this.logger.warning(`Skipped ${extension.name} because execute is not a function.`);

                return null;
            }

            await extension.execute(toolbox as IToolbox);

            return null;
        };

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const extension of this.extensions) {
            // eslint-disable-next-line no-await-in-loop
            await callback(extension);
        }

        await this.updateNotifier(toolbox as IToolbox);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { _all, positionals } = commandArgs;

        // eslint-disable-next-line security/detect-object-injection
        if (_all[POSITIONALS_KEY]) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete,security/detect-object-injection
            delete _all[POSITIONALS_KEY];
        }

        // eslint-disable-next-line security/detect-object-injection
        toolbox.argument = positionals?.[POSITIONALS_KEY] ?? [];
        toolbox.argv = this.argv;
        toolbox.options = { ..._all, ...extraOptions };

        this.logger.debug("command options parsed from options:");
        this.logger.debug(JSON.stringify(toolbox.options, null, 2));
        this.logger.debug("command argument parsed from argument:");
        this.logger.debug(JSON.stringify(toolbox.argument, null, 2));

        await this.prepareToolboxResult(commandArgs, toolbox as IToolbox, command);

        // eslint-disable-next-line unicorn/no-process-exit
        return isTest ? undefined : process.exit(0);
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

    // eslint-disable-next-line unicorn/prevent-abbreviations
    private async prepareToolboxResult(commandArgs: CommandLineOptions, toolbox: IToolbox, command: ICommand) {
        // Help is a special argument for displaying help for the given command.
        // If found, run the help command instead, with the given command name as
        // an option.
        if (commandArgs["global"]?.help) {
            this.logger.debug("'--help' option found, running 'help' for given command...");
            const helpCommand = this.commands.get("help");

            if (!helpCommand) {
                throw new Error("Help command not found.");
            }

            await helpCommand.execute(toolbox);

            return;
        }

        if (commandArgs["global"]?.version || commandArgs["global"]?.V) {
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

    // eslint-disable-next-line @typescript-eslint/no-shadow
    private async updateNotifier({ logger }: IToolbox) {
        if (
            (this.updateNotifierOptions && this.updateNotifierOptions.alwaysRun) ||
            (!(env["NO_UPDATE_NOTIFIER"] || env["NODE_ENV"] === "test" || this.argv.includes("--no-update-notifier") || isCI) && this.updateNotifierOptions)
        ) {
            // @TODO add a stream logger
            logger.log("Checking for updates...");

            const hasNewVersion = await import("./update-notifier/has-new-version").then((m) => m.default);

            const updateAvailable = await hasNewVersion(this.updateNotifierOptions);

            if (updateAvailable) {
                const template = `Update available ${chalk.dim(this.packageVersion)}${chalk.reset(" → ")}${chalk.green(updateAvailable)}`;

                this.logger.error(
                    boxen(template, {
                        borderColor: "yellow",
                        borderStyle: "round",
                        margin: 1,
                        padding: 1,
                        textAlignment: "center",
                    }),
                );
            }
        }
    }

    // eslint-disable-next-line consistent-return,sonarjs/cognitive-complexity,unicorn/prevent-abbreviations
    private validateCommandOptions<T>(arguments_: OptionDefinition<T>[], commandArgs: CommandLineOptions, command: ICommand): void {
        const missingOptions = listMissingArguments(arguments_, commandArgs);

        if (missingOptions.length > 0) {
            this.logger.error(
                `You called the command "${command.name}" without the required options: ${missingOptions.map((argument) => argument.name).join(", ")}`,
            );

            // eslint-disable-next-line unicorn/no-process-exit
            return isTest ? undefined : process.exit(1);
        }

        // eslint-disable-next-line no-underscore-dangle
        if (commandArgs._unknown && commandArgs._unknown.length > 0) {
            // eslint-disable-next-line no-underscore-dangle
            commandArgs._unknown.forEach((unknownOption) => {
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

                this.logger.error(error);
            });

            // eslint-disable-next-line unicorn/no-process-exit
            return isTest ? undefined : process.exit(1);
        }
    }
}

export default Cli;
