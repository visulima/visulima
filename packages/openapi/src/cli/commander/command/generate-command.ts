import { exit } from "node:process";
import type { Command } from "commander";

import baseGenerateCommand from "../../command/generate-command";

const generateCommand = (program: Command, commandName = "generate", configName = ".openapirc.js"): void => {
    program
        .command(commandName)
        .description("Generates OpenAPI (Swagger) documentation from JSDoc's")
        .usage("[options] <path ...>")
        .argument("[path ...]", "Paths to files or directories to parse")
        .option("-c, --config [.openapirc.js]", "Config file path for @visulima/openapi.")
        .option("-o, --output [swagger.json]", "Output swagger specification.")
        .option("--follow-symlinks", "Will follow symlinks.")
        .option("-v, --verbose", "Verbose output.")

        .action(async (paths, options) => {
            try {
                await baseGenerateCommand(configName, paths, options);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);

                exit(1);
            }
        });
};

export default generateCommand;
