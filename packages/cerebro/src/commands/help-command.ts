import { cyan, green, inverse, yellow } from "@visulima/colorize";

import defaultOptions from "../default-options";
import type { Cli as ICli } from "../types/cli";
import type { Command as ICommand, OptionDefinition } from "../types/command";
import type { Section } from "../types/command-line-usage";
import type { Toolbox as IToolbox } from "../types/toolbox";
import commandLineUsage from "../util/command-line-usage";
import templateFormat from "../util/text-processing/template-format";

const EMPTY_GROUP_KEY = "__Other";

const upperFirstChar = (string_: string): string => string_.charAt(0).toUpperCase() + string_.slice(1);

const printGeneralHelp = (logger: Console, runtime: ICli, commands: Map<string, ICommand>, groupOption: string | undefined) => {
    logger.debug("no command given, printing general help...");

    let filteredCommands = [...new Set(commands.values())].filter((command) => !command.hidden);

    if (groupOption) {
        filteredCommands = filteredCommands.filter((command) => command.group === groupOption);
    }

    // eslint-disable-next-line unicorn/no-array-reduce
    const groupedCommands: Record<string, ICommand[]> = filteredCommands.reduce<Record<string, ICommand[]>>((accumulator, command) => {
        const group = command.group ?? EMPTY_GROUP_KEY;

        if (!accumulator[group]) {
            accumulator[group] = [];
        }

        (accumulator[group] as ICommand[]).push(command);

        return accumulator;
    }, {});

    ((logger as Console & { raw?: (...args: unknown[]) => void })?.raw ?? logger.log)(
        commandLineUsage(
            [
                {
                    content: `${cyan(runtime.getCliName())} ${green("<command>")} [positional arguments] ${yellow("[options]")}`,
                    header: inverse.cyan(" Usage "),
                },
                ...Object.keys(groupedCommands).map((key) => {
                    const groupOptionName = groupOption ? ` ${upperFirstChar(groupOption)}` : "";

                    return {
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

                            return [`${green(command.name)} ${aliases}`, command.description ?? ""];
                        }),
                        header:
                            key === EMPTY_GROUP_KEY || groupOption
                                ? inverse.green(` Available${groupOptionName} Commands `)
                                : ` ${inverse.green(` ${upperFirstChar(key)} `)}`,
                    };
                }),
                commands.has("help")
                    ? {
                        header: inverse.yellow(" Command Options "),
                        optionList: (commands.get("help") as ICommand).options?.filter((option) => !option.hidden),
                    }
                    : undefined,
                { header: inverse.yellow(" Global Options "), optionList: defaultOptions },
                {
                    content: `Run "${cyan(runtime.getCliName())} ${green("help <command>")}" or "${cyan(runtime.getCliName())} ${green("<command>")} ${yellow("--help")}" for help with a specific command.`,
                    raw: true,
                },
            ].filter(Boolean) as Section[],
        ),
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const printCommandHelp = <OD extends OptionDefinition<any>>(logger: Console, runtime: ICli, commands: Map<string, ICommand<OD>>, name: string): void => {
    const command = commands.get(name) as ICommand<OD>;

    const usageGroups: Section[] = [];

    usageGroups.push({
        content: `${cyan(runtime.getCliName())} ${green(command.name)}${command.argument ? " [positional arguments]" : ""}${
            command.options ? " [options]" : ""
        }`,
        header: inverse.cyan(" Usage "),
    });

    if (command.description) {
        usageGroups.push({ content: command.description, header: inverse.green(" Description ") });
    }

    if (command.argument) {
        usageGroups.push({ header: "Command Positional Arguments", isArgument: true, optionList: [command.argument] });
    }

    if (Array.isArray(command.options) && command.options.length > 0) {
        usageGroups.push({
            header: inverse.yellow(" Command Options "),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionList: command.options.filter((option) => !option.hidden) as OptionDefinition<any>[],
        });
    }

    usageGroups.push({ header: inverse.yellow(" Global Options "), optionList: defaultOptions });

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

    ((logger as Console & { raw?: (...args: unknown[]) => void })?.raw ?? logger.log)(commandLineUsage(usageGroups));
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
            ((logger as Console & { raw?: (...args: unknown[]) => void })?.raw ?? logger.log)(templateFormat(header as string));
        }

        if (commandName === "help") {
            printGeneralHelp(logger, runtime, this.commands, options?.group);
        } else {
            printCommandHelp(logger, runtime, this.commands, commandName as string);
        }

        if (footer) {
            ((logger as Console & { raw?: (...args: unknown[]) => void })?.raw ?? logger.log)(templateFormat(footer as string));
        }
    }
}

export default HelpCommand;
