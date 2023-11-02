import type { Cli as ICli, Command as ICommand, Logger as ILogger, Toolbox as IToolbox } from "../@types";
import type { Section } from "../@types/command-line-usage";
import defaultOptions from "../default-options";
import chalkFormat from "../utils/chalk-format";
import commandLineUsage from "../utils/command-line-usage";

const printGeneralHelp = (logger: ILogger, runtime: ICli, commands: Map<string, ICommand>) => {
    logger.debug("no command given, printing general help...");

    logger.log(
        commandLineUsage([
            {
                content: `{cyan ${runtime.getCliName()}} {green <command>} [positional arguments] {yellow [options]}`,
                header: "{inverse.cyan  Usage }",
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

                        return [`{green ${command.name}} ${aliases}`, command.description ?? ""];
                    }),
                header: "{inverse.green  Available Commands }",
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
        usageGroups.push({ header: "{inverse.yellow  Command Options }", optionList: command.options });
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

        if (header) {
            logger.log(chalkFormat(header));
        }

        if (commandName === "help") {
            printGeneralHelp(logger, runtime, this.commands);
        } else {
            printCommandHelp(logger, runtime, this.commands, commandName);
        }

        if (footer) {
            logger.log(chalkFormat(footer));
        }
    }
}

export default HelpCommand;
