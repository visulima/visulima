import { watch } from "node:fs";
import { resolve } from "node:path";
import process, { exit } from "node:process";

import type { Command } from "commander";

import baseGenerateCommand from "../../command/generate-command";

type GenerateOptions = Parameters<typeof baseGenerateCommand>[2] & { watch?: boolean };

// Collapse bursts of filesystem events into a single regeneration.
const WATCH_DEBOUNCE_MS = 200;

const logError = (error: unknown): void => {
    // eslint-disable-next-line no-console
    console.error(error);
};

const startWatchMode = async (configName: string, paths: string[], options: GenerateOptions): Promise<void> => {
    let running = false;
    let pending = false;

    // Serialize runs so a burst of events cannot launch concurrent regenerations
    // racing to write the same output file.
    const run = async (): Promise<void> => {
        if (running) {
            pending = true;

            return;
        }

        running = true;

        try {
            await baseGenerateCommand(configName, paths, options);
        } catch (error) {
            logError(error);
        } finally {
            running = false;

            if (pending) {
                pending = false;

                void run();
            }
        }
    };

    // Ignore events for the generated output file so writing it does not re-trigger
    // the watcher (an infinite loop when the output lives inside a watched path).
    const outputPath = resolve(options.output ?? "swagger.json");

    let debounceTimer: NodeJS.Timeout | undefined;

    const schedule = (): void => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            debounceTimer = undefined;

            void run();
        }, WATCH_DEBOUNCE_MS);
    };

    const watchers = paths.map((p) =>
        watch(p, { recursive: true }, (_event, filename) => {
            if (filename !== null && resolve(p, filename.toString()) === outputPath) {
                return;
            }

            schedule();
        }),
    );

    const close = (): void => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        watchers.forEach((w) => {
            w.close();
        });

        exit(0);
    };

    process.once("SIGINT", close);
    process.once("SIGTERM", close);

    await run();

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
            try {
                if (options.watch) {
                    await startWatchMode(configName, paths, options);

                    return;
                }

                await baseGenerateCommand(configName, paths, options);
            } catch (error) {
                logError(error);

                exit(1);
            }
        });
};

export default generateCommand;
