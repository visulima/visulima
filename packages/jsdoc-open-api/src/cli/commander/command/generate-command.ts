// eslint-disable-next-line import/no-extraneous-dependencies
import type { Command } from "commander";
import { exit } from "node:process";

import baseGenerateCommand from "../../command/generate-command";

const generateCommand = (program: Command, commandName: string = "generate", configName: string = ".openapirc.js"): void => {
    program
        .command(commandName)
        .description("Generates OpenAPI (Swagger) documentation from JSDoc's")
        .usage("[options] <path ...>")
        .argument("[path ...]", "Paths to files or directories to parse")
        .option("-c, --config [.openapirc.js]", "@visulima/jsdoc-open-api config file path.")
        .option("-o, --output [swaggerSpec.json]", "Output swagger specification.")
        .option("-v, --verbose", "Verbose output.")
        .option("-vv, --very-verbose", "Very verbose output.")
        // eslint-disable-next-line sonarjs/cognitive-complexity
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
