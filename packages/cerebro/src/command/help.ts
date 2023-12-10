import type { Cli as ICli, Command as ICommand, Logger as ILogger, Toolbox as IToolbox } from "../@types";
import type { OptionDefinition } from "../@types/command";
import type { Section } from "../@types/command-line-usage";
import defaultOptions from "../default-options";
import chalkFormat from "../util/chalk-format";
import commandLineUsage from "../util/command-line-usage";

const EMPTY_GROUP_KEY = "__Other";

const upperFirstChar = (string_: string): string => string_.charAt(0).toUpperCase() + string_.slice(1);

// eslint-disable-next-line sonarjs/cognitive-complexity
const printGeneralHelp = (logger: ILogger, runtime: ICli, commands: Map<string, ICommand>, groupOption: string | undefined) => {
    logger.debug("no command given, printing general help...");

    let filteredCommands = [...new Set(commands.values())].filter((command) => !command.hidden);

    if (groupOption) {
        filteredCommands = filteredCommands.filter((command) => command.group === groupOption);
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    const groupedCommands: Record<string, ICommand[]> = filteredCommands.reduce<Record<string, ICommand[]>>((accumulator, command) => {
        const group = command.group ?? EMPTY_GROUP_KEY;

        // eslint-disable-next-line security/detect-object-injection
        if (!accumulator[group]) {
            // eslint-disable-next-line security/detect-object-injection
            accumulator[group] = [];
        }

        // eslint-disable-next-line security/detect-object-injection
        (accumulator[group] as ICommand[]).push(command);

        return accumulator;
    }, {});

    logger.log(
        commandLineUsage([
            {
                content: `{cyan ${runtime.getCliName()}} {green <command>} [positional arguments] {yellow [options]}`,
                header: "{inverse.cyan  Usage }",
            },
            ...Object.keys(groupedCommands).map((key) => {
                return {
                    // eslint-disable-next-line security/detect-object-injection
                    content: (groupedCommands[key] as ICommand[]).map((command) => {
                        let aliases = "";

                        if (typeof command.alias === "string") {
                            aliases = command.alias;
                        } else if (Array.isArray(command.alias)) {
                            aliases = command.alias.join(", ");
                        }

                        if (aliases !== "") {
                            aliases = ` [${aliases}]`;
                        }

                        return [`{green ${command.name}} ${aliases}`, command.description ?? ""];
                    }),
                    header:
                        key === EMPTY_GROUP_KEY || groupOption
                            ? `{inverse.green  Available${groupOption ? ` ${upperFirstChar(groupOption)}` : ""} Commands }`
                            : ` {inverse.green  ${upperFirstChar(key)} }`,
                };
            }),
            {
                header: "{inverse.yellow  Command Options }",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                optionList: ((commands.get("help") as ICommand).options as OptionDefinition<any>[]).filter((option) => !option.hidden),
            },
            { header: "{inverse.yellow  Global Options }", optionList: defaultOptions },
            {
                content: `Run "{cyan ${runtime.getCliName()}} {green help <command>}" or "{cyan ${runtime.getCliName()}} {green <command>} {yellow --help}" for help with a specific command.`,
                raw: true,
            },
        ]),
    );
};

const printCommandHelp = (logger: ILogger, runtime: ICli, commands: Map<string, ICommand>, name: string): void => {
    const command = commands.get(name) as ICommand;

    const usageGroups: Section[] = [];

    usageGroups.push({
        content: `{cyan ${runtime.getCliName()}} {green ${command.name}}${command.argument ? " [positional arguments]" : ""}${
            command.options ? " [options]" : ""
        }`,
        header: "{inverse.cyan  Usage }",
    });

    if (command.description) {
        usageGroups.push({ content: command.description, header: "{inverse.green  Description }" });
    }

    if (command.argument) {
        usageGroups.push({ header: "Command Positional Arguments", isArgument: true, optionList: [command.argument] });
    }

    if (Array.isArray(command.options) && command.options.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usageGroups.push({ header: "{inverse.yellow  Command Options }", optionList: command.options.filter((option) => !option.hidden) as OptionDefinition<any>[] });
    }

    usageGroups.push({ header: "{inverse.yellow  Global Options }", optionList: defaultOptions });

    if (command.alias !== undefined && command.alias.length > 0) {
        let alias: string[] = command.alias as string[];

        if (typeof command.alias === "string") {
            alias = [command.alias];
        }

        usageGroups.splice(1, 0, {
            content: alias,
            header: "Alias(es)",
        });
    }

    if (Array.isArray(command.examples) && command.examples.length > 0) {
        usageGroups.push({
            content: command.examples,
            header: "Examples",
        });
    }

    logger.log(commandLineUsage(usageGroups));
};

class HelpCommand implements ICommand {
    public name = "help";

    public options = [
        {
            description: "Display only the specified group",
            name: "group",
            type: String,
        } as OptionDefinition<string>,
    ];

    private readonly commands: Map<string, ICommand>;

    public constructor(commands: Map<string, ICommand>) {
        this.commands = commands;
    }

    public execute(toolbox: IToolbox): void {
        const { commandName, logger, options, runtime } = toolbox;

        const { footer, header } = runtime.getCommandSection();

        if (header) {
            logger.log(chalkFormat(header));
        }

        if (commandName === "help") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unnecessary-condition
            printGeneralHelp(logger, runtime, this.commands, options?.["group"]);
        } else {
            printCommandHelp(logger, runtime, this.commands, commandName);
        }

        if (footer) {
            logger.log(chalkFormat(footer));
        }
    }
}

export default HelpCommand;
