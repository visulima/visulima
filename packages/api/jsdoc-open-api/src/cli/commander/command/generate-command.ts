import { watch } from "node:fs";
import process, { exit } from "node:process";

import type { Command } from "commander";

import baseGenerateCommand from "../../command/generate-command";

type GenerateOptions = Parameters<typeof baseGenerateCommand>[2] & { watch?: boolean };

const logError = (error: unknown): void => {
    // eslint-disable-next-line no-console
    console.error(error);
};

const startWatchMode = async (configName: string, paths: string[], options: GenerateOptions): Promise<void> => {
    const run = async (): Promise<void> => {
        await baseGenerateCommand(configName, paths, options);
    };

    const watchers = paths.map((p) => watch(p, { recursive: true }, () => {
        run().catch(logError);
    }));

    const close = (): void => {
        watchers.forEach((w) => {
            w.close();
        });

        exit(0);
    };

    process.once("SIGINT", close);
    process.once("SIGTERM", close);

    try {
        await run();
    } catch (error) {
        logError(error);
    }

    // eslint-disable-next-line no-console
    console.log("Watching for changes... (press Ctrl+C to exit)");
};

const generateCommand = (program: Command, commandName = "generate", configName = ".openapirc.js"): void => {
    program
        .command(commandName)
        .description("Generates OpenAPI (Swagger) documentation from JSDoc's")
        .usage("[options] <path ...>")
        .argument("[path ...]", "Paths to files or directories to parse")
        .option("-c, --config [.openapirc.js]", "@visulima/jsdoc-open-api config file path.")
        .option("-d, --definition [definition.yaml]", "Base OpenAPI definition file (YAML/JSON) to seed info/servers/components.")
        .option("-o, --output [swaggerSpec.json]", "Output swagger specification. Use \"-\" to write to stdout, or a .yaml/.yml path for YAML output.")
        .option("-w, --watch", "Re-generate the specification whenever a watched path changes.")
        .option("-v, --verbose", "Verbose output.")
        .option("--very-verbose", "Very verbose output.")

        .action(async (paths: string[], options: GenerateOptions) => {
            if (options.watch) {
                await startWatchMode(configName, paths, options);

                return;
            }

            try {
                await baseGenerateCommand(configName, paths, options);
            } catch (error) {
                logError(error);

                exit(1);
            }
        });
};

export default generateCommand;
