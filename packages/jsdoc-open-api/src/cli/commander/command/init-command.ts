// eslint-disable-next-line import/no-extraneous-dependencies
import { Command } from "commander";
import { exit } from "node:process";

import baseInitCommand from "../../command/init-command";

const initCommand = (
    program: Command,
    commandName: string = "init",
    description: string = "Inits a pre-configured @visulima/jsdoc-open-api config file.",
    configName: string = ".openapirc.js",
) => {
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
