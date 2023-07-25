import type { Command } from "commander";
import { exit } from "node:process";

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
                console.error(error);
                exit(1);
            }
        });
};

export default initCommand;
