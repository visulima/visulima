import type { Cli as ICli, Command as ICommand, Logger as ILogger, Print as IPrint, Toolbox as IToolbox } from "../@types";
import type { Section } from "../@types/command-line-usage";
import defaultOptions from "../default-options";
import commandLineUsage from "../command-line-usage";
import chalkFormat from "../utils/chalk-format";

const printGeneralHelp = (logger: ILogger, runtime: ICli, print: IPrint, commands: Map<string, ICommand>) => {
    logger.debug("no command given, printing general help...");

    logger.log(
        commandLineUsage([
            {
                content: `${print.colors.cyan(runtime.getCliName())} ${print.colors.green("<command>")} [positional arguments] [options]`,
                header: "Usage",
            },
            {
                content: [...new Set(commands.values())]
                    .filter((command) => !command.hidden)
                    .map((command) => {
                        let aliases = "";

                        if (typeof command.alias === "string") {
                            aliases = command.alias;
                        } else if (Array.isArray(command.alias)) {
                            aliases = command.alias.join(", ");
                        }

                        if (aliases !== "") {
                            aliases = ` [${aliases}]`;
                        }

                        return [print.colors.green(command.name) + aliases, command.description ?? ""];
                    }),
                header: "Available Commands",
            },
            { header: "Global Options", optionList: defaultOptions },
            {
                content: `Run "${runtime.getCliName()} help <command>" or "${runtime.getCliName()} <command> --help" for help with a specific command.`,
                raw: true,
            },
        ]),
    );
};

const printCommandHelp = (logger: ILogger, commands: Map<string, ICommand>, name: string): void => {
    const command = commands.get(name) as ICommand;

    logger.log("");
    logger.info(command.name);

    if (command.description) {
        logger.log(command.description);
    }

    const usageGroups: Section[] = [];

    if (command.argument) {
        usageGroups.push({ header: "Command Positional Arguments", isArgument: true, optionList: [command.argument], });
    }

    if (Array.isArray(command.options) && command.options.length > 0) {
        usageGroups.push({ header: "Command Options", optionList: command.options });
    }

    usageGroups.push({ header: "Global Options", optionList: defaultOptions });

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
            defaultOption: true,
            description: "The command to display help for",
            name: "command",
        },
    ];

    public usage = [];

    private readonly commands: Map<string, ICommand>;

    public constructor(commands: Map<string, ICommand>) {
        this.commands = commands;
    }

    public execute(toolbox: IToolbox): void {
        const { commandName, logger, runtime } = toolbox;

        const { footer, header } = runtime.getCommandSection();

        logger.log(chalkFormat(header));

        if (commandName === "help") {
            printGeneralHelp(logger, runtime, toolbox.print, this.commands);
        } else {
            printCommandHelp(logger, this.commands, commandName);
        }

        if (footer) {
            logger.log(chalkFormat(footer));
        }
    }
}

export default HelpCommand;
