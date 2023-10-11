import { exit } from "node:process";

import type { Command } from "commander";

import baseInitCommand from "../../command/init-command";

const initCommand = (
    program: Command,
    commandName = "init",
    description = "Inits a pre-configured @visulima/jsdoc-open-api config file.",
    configName = ".openapirc.js",
): void => {
    program
        .command(commandName)
        .description(description)
        .action(() => {
            try {
                baseInitCommand(configName);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                exit(1);
            }
        });
};

export default initCommand;
